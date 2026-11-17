// Richtet die Datenbankrollen ein (idempotent). Läuft als Superuser über
// DATABASE_ADMIN_URL; Namen und Passwörter der Rollen stammen aus
// DATABASE_MIGRATION_URL und DATABASE_URL.
import postgres from 'postgres';
import { z } from 'zod';
import { parseEnv, postgresUrl } from './config.js';
import {
  APP_ROLE,
  MIGRATION_ROLE,
  credentialsFromUrl,
  type RoleCredentials,
} from './roles.js';

const env = parseEnv(
  z.object({
    DATABASE_ADMIN_URL: postgresUrl('DATABASE_ADMIN_URL'),
    DATABASE_MIGRATION_URL: postgresUrl('DATABASE_MIGRATION_URL'),
    DATABASE_URL: postgresUrl('DATABASE_URL'),
  }),
);

const migration = credentialsFromUrl(
  env.DATABASE_MIGRATION_URL,
  MIGRATION_ROLE,
  'DATABASE_MIGRATION_URL',
);
const app = credentialsFromUrl(env.DATABASE_URL, APP_ROLE, 'DATABASE_URL');

const admin = postgres(env.DATABASE_ADMIN_URL, {
  max: 1,
  connect_timeout: 5,
  onnotice: () => {},
});

// Bezeichner und Passwort quotet der Server selbst über format(%I, %L).
async function run(template: string, ...args: string[]) {
  const [row] =
    await admin`select format(${template}, variadic ${args}::text[]) as stmt`;
  await admin.unsafe(row!.stmt as string);
}

async function ensureRole({ name, password }: RoleCredentials) {
  const [row] =
    await admin`select exists(select 1 from pg_roles where rolname = ${name}) as vorhanden`;
  const verb = row!.vorhanden ? 'ALTER' : 'CREATE';
  await run(
    `${verb} ROLE %I WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT PASSWORD %L`,
    name,
    password,
  );
}

try {
  const [self] =
    await admin`select rolsuper from pg_roles where rolname = current_user`;
  if (!self?.rolsuper) {
    throw new Error('DATABASE_ADMIN_URL muss auf einen Superuser zeigen.');
  }

  await ensureRole(migration);
  await ensureRole(app);

  const [current] = await admin`select current_database() as db`;
  const db = current!.db as string;

  // Migrationsrolle besitzt Datenbank und Schema public (darf Tabellen anlegen).
  await run('ALTER DATABASE %I OWNER TO %I', db, MIGRATION_ROLE);
  await run('ALTER SCHEMA public OWNER TO %I', MIGRATION_ROLE);

  // Bestehende Drizzle-Verwaltung übertragen (z. B. lokale Datenbank aus Block 2).
  const drizzleTables =
    await admin`select tablename from pg_tables where schemaname = 'drizzle'`;
  if (drizzleTables.length > 0) {
    await run('ALTER SCHEMA drizzle OWNER TO %I', MIGRATION_ROLE);
    for (const { tablename } of drizzleTables) {
      await run(
        'ALTER TABLE drizzle.%I OWNER TO %I',
        tablename,
        MIGRATION_ROLE,
      );
    }
  }

  // pgvector ist keine "trusted" Erweiterung: nur ein Superuser darf sie anlegen.
  await admin`create extension if not exists vector`;

  // Anwendungsrolle: nur verbinden und das Schema sehen. Tabellenrechte
  // vergeben die Migrationen einzeln.
  await run('REVOKE ALL ON DATABASE %I FROM PUBLIC', db);
  await run('GRANT CONNECT ON DATABASE %I TO %I', db, APP_ROLE);
  await run(
    'GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I',
    db,
    MIGRATION_ROLE,
  );
  await admin`revoke create on schema public from public`;
  await run('GRANT USAGE ON SCHEMA public TO %I', APP_ROLE);

  console.log(`Rollen ${MIGRATION_ROLE} und ${APP_ROLE} eingerichtet.`);
} finally {
  await admin.end();
}
