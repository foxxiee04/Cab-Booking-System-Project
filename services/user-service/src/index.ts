import { createApp } from './app';
import { config } from './config';
import userRoutes from './routes/user.routes';
import { checkDatabaseReadiness, connectDB, disconnectDB, prisma } from './config/db';
import { createHealthServiceRegistration, createHttpBridgeServiceRegistration, shutdownGrpcServer, startGrpcServer } from '../../../shared/dist';

export async function start() {
  await connectDB();
  const getReadiness = async () => ({
    postgres: await checkDatabaseReadiness(),
  });

  const app = createApp({
    getReadiness,
  });

  const grpcServer = await startGrpcServer({
    address: `0.0.0.0:${config.grpcPort}`,
    registrations: [
      createHealthServiceRegistration(config.serviceName, getReadiness),
      createHttpBridgeServiceRegistration(`http://127.0.0.1:${config.port}`),
    ],
  });

  const server = app.listen(config.port, () => {
    console.log(`User Service running on port ${config.port}`);
    console.log(`User gRPC Service running on port ${config.grpcPort}`);
  });

  process.on('SIGTERM', async () => {
    await shutdownGrpcServer(grpcServer);
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
