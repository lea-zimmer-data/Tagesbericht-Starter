import { sql } from 'drizzle-orm';
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Primärschlüssel als UUIDv7, erzeugt durch die Funktion aus Migration 0001.
const id = () =>
  uuid('id')
    .primaryKey()
    .default(sql`uuidv7()`);

const zeitpunkt = (name: string) => timestamp(name, { withTimezone: true });

// Rollen nach Anforderung, Abschnitt 3.
export const rolle = pgEnum('rolle', ['mitarbeiter', 'bauleitung']);

export const organisation = pgTable('organisation', {
  id: id(),
  name: text('name').notNull(),
  anschrift: text('anschrift'),
  createdAt: zeitpunkt('created_at').notNull().defaultNow(),
});

// benutzer und einladung: Row-Level-Security in Migration 0003 (handgeschrieben).
export const benutzer = pgTable(
  'benutzer',
  {
    id: id(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organisation.id),
    email: text('email').notNull(),
    name: text('name').notNull(),
    rolle: rolle('rolle').notNull(),
    // Nichts wird physisch gelöscht (R-5.5): Deaktivieren über aktiv.
    aktiv: boolean('aktiv').notNull().default(true),
    letzterLogin: zeitpunkt('letzter_login'),
  },
  (t) => [unique('benutzer_org_id_email_unique').on(t.orgId, t.email)],
);

export const einladung = pgTable('einladung', {
  id: id(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => organisation.id),
  email: text('email').notNull(),
  rolle: rolle('rolle').notNull(),
  tokenHash: text('token_hash').notNull().unique(),
  gueltigBis: zeitpunkt('gueltig_bis').notNull(),
  eingeloestAm: zeitpunkt('eingeloest_am'),
});
