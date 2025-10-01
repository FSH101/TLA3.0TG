import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';

import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import createHttpError from 'http-errors';
import helmet from 'helmet';
import morgan from 'morgan';

import { artRouter } from './assets';
import { env } from './env';
import { authRouter } from './routes/auth';
import { assetsRouter } from './routes/assets';
import { registerWsServer } from './ws/server';
import { mapsRouter } from './routes/maps';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(morgan('combined'));
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
  })
);

app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/maps', mapsRouter);
app.use('/art', artRouter);

const clientDist = path.resolve('packages', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist, { extensions: ['html'] }));
  app.get('*', (_req, res, next) => {
    const indexFile = path.join(clientDist, 'index.html');
    if (fs.existsSync(indexFile)) {
      res.sendFile(indexFile);
      return;
    }
    next();
  });
}

app.use((_req, _res, next) => {
  next(createHttpError(404, 'Not Found'));
});

app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const error = createHttpError.isHttpError(err)
    ? err
    : createHttpError(500, err instanceof Error ? err.message : 'Unknown error');
  res.status(error.statusCode).json({ error: error.message });
});

const server = http.createServer(app);
registerWsServer(server);

server.listen(env.PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server listening on port ${env.PORT}`);
});

const shutdownSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
shutdownSignals.forEach((signal) => {
  process.on(signal, () => {
    server.close(() => {
      // eslint-disable-next-line no-console
      console.log('HTTP server closed');
      process.exit(0);
    });
  });
});
