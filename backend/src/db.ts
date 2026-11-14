import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';

export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { max: 5, connect_timeout: 5 });
  const db = drizzle(client);

  async function checkDb(): Promise<boolean> {
    try {
      await db.execute(sql`select 1`);
      return true;
    } catch {
      return false;
    }
  }

  return { db, checkDb, close: () => client.end() };
}
