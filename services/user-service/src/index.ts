import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import userRoutes from './routes/user.routes';
import { prisma } from './config/db';

async function main() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json());
  app.use(morgan('dev'));

  app.get('/health', (_, res) => {
    res.json({ status: 'ok', service: config.serviceName });
  });

  app.use('/api/users', userRoutes);

  await prisma.$connect();

  app.listen(config.port, () => {
    console.log(`User Service running on port ${config.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
