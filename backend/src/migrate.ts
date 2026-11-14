import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { loadConfig } from './config.js';
import { createDb } from './db.js';

const config = loadConfig();
const { db, close } = createDb(config.DATABASE_URL);

try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrationen angewendet.');
} finally {
  await close();
}
