import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

describe('GET /health', () => {
  const apps: ReturnType<typeof buildApp>[] = [];
  afterEach(async () => {
    await Promise.all(apps.splice(0).map((a) => a.close()));
  });

  function make(dbOk: boolean) {
    const app = buildApp({ checkDb: async () => dbOk });
    apps.push(app);
    return app;
  }

  it('meldet ok, wenn die Datenbank erreichbar ist', async () => {
    const res = await make(true).inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: 'ok', datenbank: true });
  });

  it('meldet fehler mit 503, wenn die Datenbank nicht erreichbar ist', async () => {
    const res = await make(false).inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'fehler', datenbank: false });
  });
});
