import Fastify from 'fastify';

export interface AppDeps {
  checkDb: () => Promise<boolean>;
}

export function buildApp({ checkDb }: AppDeps) {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  app.get('/health', async (_request, reply) => {
    const datenbank = await checkDb();
    return reply
      .code(datenbank ? 200 : 503)
      .send({ status: datenbank ? 'ok' : 'fehler', datenbank });
  });

  return app;
}
