import { createApp } from './app';
import { config } from './config';
import userRoutes from './routes/user.routes';
import { checkDatabaseReadiness, connectDB, disconnectDB, prisma } from './config/db';

export async function start() {
  await connectDB();

  const app = createApp({
    getReadiness: async () => ({
      postgres: await checkDatabaseReadiness(),
    }),
  });

  const server = app.listen(config.port, () => {
    console.log(`User Service running on port ${config.port}`);
  });

  process.on('SIGTERM', async () => {
    await disconnectDB();
    server.close();
    process.exit(0);
  });

  return { app, server };
}

if (require.main === module) {
  start().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
