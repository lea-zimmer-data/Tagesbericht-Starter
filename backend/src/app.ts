import Fastify from 'fastify';
import { apiRoutes, type ApiDeps } from './auth.js';

export interface AppDeps {
  checkDb: () => Promise<boolean>;
  /** Ohne api nur /health (z. B. im Test ohne Datenbank). */
  api?: ApiDeps;
}

export function buildApp({ checkDb, api }: AppDeps) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.get('/health', async (_request, reply) => {
    const datenbank = await checkDb();
    return reply
      .code(datenbank ? 200 : 503)
      .send({ status: datenbank ? 'ok' : 'fehler', datenbank });
  });

  if (api) {
    app.register(apiRoutes, { prefix: '/api', ...api });
  }

  return app;
}
