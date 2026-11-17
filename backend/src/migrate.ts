import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { z } from 'zod';
import { parseEnv, postgresUrl } from './config.js';
import { createDb } from './db.js';

// Migrationen laufen als Migrationsrolle (Eigentümerin der Tabellen).
const env = parseEnv(
  z.object({ DATABASE_MIGRATION_URL: postgresUrl('DATABASE_MIGRATION_URL') }),
);
const { db, close } = createDb(env.DATABASE_MIGRATION_URL);

try {
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('Migrationen angewendet.');
} finally {
  await close();
}
