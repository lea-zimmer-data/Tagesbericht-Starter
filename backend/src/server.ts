import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { createDb } from './db.js';

let config;
try {
  config = loadConfig();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

const { checkDb, close } = createDb(config.DATABASE_URL);
const app = buildApp({ checkDb });

app.addHook('onClose', async () => {
  await close();
});

await app.listen({ port: config.PORT, host: config.HOST });
