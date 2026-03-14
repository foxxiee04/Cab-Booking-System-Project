import { appendFile, mkdir, open, readFile, rm } from 'fs/promises';
import { createWriteStream } from 'fs';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

const rootDir = path.resolve(__dirname, '..');
const logDir = path.join(rootDir, '.ci-logs');
const composeFile = path.join(rootDir, '.github', 'docker', 'docker-compose.integration.yml');
const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const npxCommand = isWindows ? 'npx.cmd' : 'npx';

const requiredEnvNames = [
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'MONGO_USER',
  'MONGO_PASSWORD',
  'RABBITMQ_USER',
  'RABBITMQ_PASS',
  'JWT_SECRET',
  'REFRESH_TOKEN_SECRET',
  'INTERNAL_SERVICE_TOKEN',
  'OSRM_BASE_URL',
] as const;

const serviceProcesses = new Map<string, ChildProcess>();

async function logStep(message: string) {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  await appendFile(path.join(logDir, 'runner.log'), `${line}\n`);
}

function quoteWindowsArg(arg: string) {
  if (!arg) {
    return '""';
  }

  if (!/[\s"&()^<>|]/.test(arg)) {
    return arg;
  }

  return `"${arg.replace(/"/g, '\\"')}"`;
}

function spawnProcess(command: string, args: string[], options?: { env?: NodeJS.ProcessEnv; cwd?: string; stdio?: 'inherit' | 'pipe' }) {
  const spawnOptions = {
    cwd: options?.cwd ?? rootDir,
    env: options?.env ?? process.env,
    stdio: options?.stdio ?? 'inherit',
    shell: false,
  } as const;

  if (isWindows && command.toLowerCase().endsWith('.cmd')) {
    const commandLine = [command, ...args].map(quoteWindowsArg).join(' ');
    return spawn('cmd.exe', ['/d', '/s', '/c', commandLine], spawnOptions);
  }

  return spawn(command, args, spawnOptions);
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function pgUrl(database: string) {
  return `postgresql://${requireEnv('POSTGRES_USER')}:${requireEnv('POSTGRES_PASSWORD')}@127.0.0.1:55432/${database}?schema=public`;
}

function mongoUrl(database: string) {
  return `mongodb://${requireEnv('MONGO_USER')}:${requireEnv('MONGO_PASSWORD')}@127.0.0.1:27018/${database}?authSource=admin`;
}

async function ensureLogDir() {
  await rm(logDir, { recursive: true, force: true });
  await mkdir(logDir, { recursive: true });
}

async function runCommand(command: string, args: string[], options?: { env?: NodeJS.ProcessEnv; cwd?: string; stdio?: 'inherit' | 'pipe' }) {
  return new Promise<void>((resolve, reject) => {
    const child = spawnProcess(command, args, options);

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`));
    });
  });
}

async function showLog(service: string) {
  const logFile = path.join(logDir, `${service}.log`);
  try {
    const content = await readFile(logFile, 'utf8');
    const lines = content.trim().split(/\r?\n/);
    const tail = lines.slice(-80).join('\n');
    if (tail) {
      console.log(`===== ${service} log =====`);
      console.log(tail);
    }
  } catch {
    // Ignore missing logs during cleanup/reporting.
  }
}

async function startService(service: string, env: NodeJS.ProcessEnv) {
  const logFile = path.join(logDir, `${service}.log`);
  const handle = await open(logFile, 'w');
  const stream = createWriteStream(logFile, { flags: 'a' });

  const startedChild = spawnProcess(npmCommand, ['-w', `services/${service}`, 'run', 'start'], {
    cwd: rootDir,
    env,
    stdio: 'pipe',
  });

  startedChild.stdout?.pipe(stream);
  startedChild.stderr?.pipe(stream);

  startedChild.on('exit', async (code) => {
    stream.end();
    await handle.close();
    if (code && code !== 0) {
      console.error(`${service} exited early with code ${code}`);
    }
  });

  serviceProcesses.set(service, startedChild);
}

async function waitForHttp(service: string, url: string) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        console.log(`${service} is ready at ${url}`);
        return;
      }
    } catch {
      // keep retrying
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  await showLog(service);
  throw new Error(`Timed out waiting for ${service} at ${url}`);
}

async function runPrismaPush(schemaPath: string, databaseUrl: string) {
  await runCommand(npxCommand, ['prisma', 'db', 'push', '--skip-generate', '--schema', schemaPath], {
    env: { ...process.env, DATABASE_URL: databaseUrl },
  });
}

async function buildBackendArtifacts() {
  if (process.env.SKIP_BUILD === '1') {
    await logStep('Skipping backend artifact build');
    return;
  }

  await logStep('Building shared package');
  await runCommand(npmCommand, ['run', 'build:shared']);

  const services = [
    'auth-service',
    'user-service',
    'payment-service',
    'notification-service',
    'review-service',
    'pricing-service',
    'ride-service',
    'driver-service',
    'booking-service',
  ];

  for (const service of services) {
    await logStep(`Building ${service}`);
    await runCommand(npmCommand, ['-w', `services/${service}`, 'run', 'build']);
  }
}

async function stopServices() {
  const waits: Array<Promise<void>> = [];

  for (const [service, child] of serviceProcesses.entries()) {
    waits.push(new Promise((resolve) => {
      if (child.exitCode !== null) {
        resolve();
        return;
      }

      const timeout = setTimeout(() => {
        if (isWindows && child.pid) {
          runCommand('taskkill', ['/PID', String(child.pid), '/T', '/F']).catch(() => undefined);
          return;
        }

        child.kill();
      }, 5000);

      child.once('exit', async () => {
        clearTimeout(timeout);
        await showLog(service);
        resolve();
      });

      if (isWindows && child.pid) {
        runCommand('taskkill', ['/PID', String(child.pid), '/T', '/F']).catch(() => undefined);
        return;
      }

      child.kill();
    }));
  }

  await Promise.all(waits);
  serviceProcesses.clear();
}

async function stopInfrastructure() {
  await runCommand('docker', ['compose', '-f', composeFile, 'down', '-v']).catch((error) => {
    console.warn(`Failed to stop integration infrastructure cleanly: ${error instanceof Error ? error.message : String(error)}`);
  });
}

async function main() {
  requiredEnvNames.forEach((name) => requireEnv(name));
  await ensureLogDir();

  process.on('SIGINT', async () => {
    await stopServices();
    await stopInfrastructure();
    process.exit(130);
  });

  process.on('SIGTERM', async () => {
    await stopServices();
    await stopInfrastructure();
    process.exit(143);
  });

  const authDb = pgUrl('auth_db');
  const bookingDb = pgUrl('booking_db');
  const driverDb = pgUrl('driver_db');
  const paymentDb = pgUrl('payment_db');
  const rideDb = pgUrl('ride_db');
  const userDb = pgUrl('user_db');
  const notificationMongo = mongoUrl('notification_db');
  const reviewMongo = mongoUrl('review_db');
  const rabbitmqUrl = `amqp://${requireEnv('RABBITMQ_USER')}:${requireEnv('RABBITMQ_PASS')}@127.0.0.1:5673`;
  const redisUrl = 'redis://127.0.0.1:6380';
  const aiServiceUrl = 'http://127.0.0.1:18000';

  try {
    await logStep('Starting integration runner');
    await buildBackendArtifacts();
    await logStep('Starting Docker infrastructure');
    await runCommand('docker', ['compose', '-f', composeFile, 'up', '-d', '--build', '--wait']);

    await logStep('Pushing Prisma schemas');
    await runPrismaPush('services/auth-service/prisma/schema.prisma', authDb);
    await runPrismaPush('services/booking-service/prisma/schema.prisma', bookingDb);
    await runPrismaPush('services/driver-service/prisma/schema.prisma', driverDb);
    await runPrismaPush('services/payment-service/prisma/schema.prisma', paymentDb);
    await runPrismaPush('services/ride-service/prisma/schema.prisma', rideDb);
    await runPrismaPush('services/user-service/prisma/schema.prisma', userDb);

    const commonEnv = { ...process.env, NODE_ENV: 'test' };

    await logStep('Starting backend services');
    await startService('auth-service', {
      ...commonEnv,
      PORT: '3001',
      DATABASE_URL: authDb,
      RABBITMQ_URL: rabbitmqUrl,
      JWT_SECRET: requireEnv('JWT_SECRET'),
      REFRESH_TOKEN_SECRET: requireEnv('REFRESH_TOKEN_SECRET'),
      JWT_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN: '7d',
      INTERNAL_SERVICE_TOKEN: requireEnv('INTERNAL_SERVICE_TOKEN'),
    });

    await startService('user-service', {
      ...commonEnv,
      PORT: '3007',
      DATABASE_URL: userDb,
    });

    await startService('payment-service', {
      ...commonEnv,
      PORT: '3004',
      DATABASE_URL: paymentDb,
      RABBITMQ_URL: rabbitmqUrl,
      JWT_SECRET: requireEnv('JWT_SECRET'),
    });

    await startService('notification-service', {
      ...commonEnv,
      PORT: '3005',
      MONGODB_URI: notificationMongo,
      REDIS_URL: redisUrl,
      RABBITMQ_URL: rabbitmqUrl,
      JWT_SECRET: requireEnv('JWT_SECRET'),
      EMAIL_ENABLED: 'false',
      SMS_ENABLED: 'false',
    });

    await startService('review-service', {
      ...commonEnv,
      PORT: '3010',
      MONGODB_URI: reviewMongo,
      JWT_SECRET: requireEnv('JWT_SECRET'),
    });

    await startService('pricing-service', {
      ...commonEnv,
      PORT: '3009',
      AI_SERVICE_URL: aiServiceUrl,
      REDIS_URL: redisUrl,
      OSRM_BASE_URL: requireEnv('OSRM_BASE_URL'),
      RABBITMQ_URL: rabbitmqUrl,
    });

    await startService('ride-service', {
      ...commonEnv,
      PORT: '3002',
      DATABASE_URL: rideDb,
      REDIS_URL: redisUrl,
      RABBITMQ_URL: rabbitmqUrl,
      PRICING_SERVICE_URL: 'http://127.0.0.1:3009',
      DRIVER_SERVICE_URL: 'http://127.0.0.1:3003',
      JWT_SECRET: requireEnv('JWT_SECRET'),
      INTERNAL_SERVICE_TOKEN: requireEnv('INTERNAL_SERVICE_TOKEN'),
    });

    await startService('driver-service', {
      ...commonEnv,
      PORT: '3003',
      DATABASE_URL: driverDb,
      REDIS_URL: redisUrl,
      RABBITMQ_URL: rabbitmqUrl,
      JWT_SECRET: requireEnv('JWT_SECRET'),
      INTERNAL_SERVICE_TOKEN: requireEnv('INTERNAL_SERVICE_TOKEN'),
      RIDE_SERVICE_URL: 'http://127.0.0.1:3002',
    });

    await startService('booking-service', {
      ...commonEnv,
      PORT: '3008',
      DATABASE_URL: bookingDb,
      RABBITMQ_URL: rabbitmqUrl,
      PRICING_SERVICE_URL: 'http://127.0.0.1:3009',
      RIDE_SERVICE_URL: 'http://127.0.0.1:3002',
    });

    await logStep('Waiting for service health endpoints');
    await waitForHttp('auth-service', 'http://127.0.0.1:3001/health');
    await waitForHttp('user-service', 'http://127.0.0.1:3007/health');
    await waitForHttp('driver-service', 'http://127.0.0.1:3003/health');
    await waitForHttp('booking-service', 'http://127.0.0.1:3008/health');
    await waitForHttp('pricing-service', 'http://127.0.0.1:3009/health');
    await waitForHttp('ride-service', 'http://127.0.0.1:3002/health');
    await waitForHttp('payment-service', 'http://127.0.0.1:3004/health');
    await waitForHttp('notification-service', 'http://127.0.0.1:3005/health');
    await waitForHttp('review-service', 'http://127.0.0.1:3010/health');

    await logStep('Running integration tests');
    await runCommand(npmCommand, ['run', 'test:integration']);
    await logStep('Integration runner completed successfully');
  } finally {
    await logStep('Stopping backend services and infrastructure');
    await stopServices();
    await stopInfrastructure();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  appendFile(path.join(logDir, 'runner.log'), `[${new Date().toISOString()}] ERROR: ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`).catch(() => undefined);
  process.exit(1);
});