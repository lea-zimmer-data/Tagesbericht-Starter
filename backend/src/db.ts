import { drizzle } from 'drizzle-orm/postgres-js';
import { sql } from 'drizzle-orm';
import postgres from 'postgres';
import { z } from 'zod';

export function createDb(databaseUrl: string, options: { max?: number } = {}) {
  const client = postgres(databaseUrl, {
    max: options.max ?? 5,
    connect_timeout: 5,
  });
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

export type Db = ReturnType<typeof createDb>['db'];
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const orgIdSchema = z.uuid({ error: 'orgId ist keine gültige UUID' });

/**
 * Führt `work` in einer Transaktion aus, in der app.current_org gesetzt ist.
 * set_config(..., true) gilt nur für diese Transaktion: Eine Verbindung aus
 * dem Pool trägt den Mandantenkontext danach nicht weiter.
 */
export async function withOrg<T>(
  db: Db,
  orgId: string,
  work: (tx: Tx) => Promise<T>,
): Promise<T> {
  const id = orgIdSchema.parse(orgId);
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.current_org', ${id}, true)`);
    return work(tx);
  });
}
