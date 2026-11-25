// Anmeldung (F-01) und Mandantenkontext pro Request (R-4.2).
// - Sitzung: verschlüsseltes Cookie (@fastify/secure-session), Inhalt nur
//   benutzerId und orgId, Laufzeit 8 Stunden.
// - Einzige Abfrage ohne Mandantenkontext ist anmeldung_benutzer() beim Login
//   (Migration 0005). Alle übrigen laufen über withOrg().
import { randomBytes } from 'node:crypto';
import secureSession from '@fastify/secure-session';
import { and, eq, sql } from 'drizzle-orm';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import { withOrg, type Db, type Tx } from './db.js';
import { hashPassword, verifyPassword } from './password.js';
import { benutzer, organisation } from './schema.js';

declare module '@fastify/secure-session' {
  interface SessionData {
    benutzerId: string;
    orgId: string;
  }
}

export interface Mandant {
  benutzerId: string;
  orgId: string;
  /** Führt Datenbankarbeit mit app.current_org = orgId der Sitzung aus. */
  run: <T>(work: (tx: Tx) => Promise<T>) => Promise<T>;
}

declare module 'fastify' {
  interface FastifyRequest {
    mandant: Mandant | null;
  }
}

export interface ApiDeps {
  db: Db;
  /** 64 Hex-Zeichen (32 Byte). */
  sessionKey: string;
  secureCookie: boolean;
}

export const SESSION_COOKIE = 'sitzung';
export const SESSION_SECONDS = 8 * 60 * 60;

const FEHLER_ANMELDUNG = { fehler: 'E-Mail oder Passwort falsch' };
const FEHLER_SITZUNG = { fehler: 'Nicht angemeldet' };

const loginBody = z.object({
  email: z.string().trim().min(1).max(320),
  passwort: z.string().min(1).max(1024),
});

interface LookupRow extends Record<string, unknown> {
  id: string;
  org_id: string;
  passwort_hash: string | null;
  aktiv: boolean;
}

// Platzhalter-Hash: Auch bei unbekannter E-Mail läuft eine Argon2-Prüfung,
// damit die Antwortzeit nicht verrät, ob es die E-Mail gibt.
let dummyHash: Promise<string> | undefined;
function getDummyHash() {
  dummyHash ??= hashPassword(randomBytes(32).toString('hex'));
  return dummyHash;
}

async function loadProfile(tx: Tx, benutzerId: string) {
  const [row] = await tx
    .select({
      name: benutzer.name,
      email: benutzer.email,
      rolle: benutzer.rolle,
      organisation: { name: organisation.name },
    })
    .from(benutzer)
    .innerJoin(organisation, eq(organisation.id, benutzer.orgId))
    .where(and(eq(benutzer.id, benutzerId), eq(benutzer.aktiv, true)));
  return row;
}

export async function apiRoutes(app: FastifyInstance, deps: ApiDeps) {
  await app.register(secureSession, {
    key: Buffer.from(deps.sessionKey, 'hex'),
    cookieName: SESSION_COOKIE,
    expiry: SESSION_SECONDS,
    cookie: {
      path: '/api',
      httpOnly: true,
      sameSite: 'strict',
      secure: deps.secureCookie,
      maxAge: SESSION_SECONDS,
    },
  });

  app.post('/anmeldung', async (request, reply) => {
    const body = loginBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ fehler: 'E-Mail und Passwort angeben' });
    }
    const { email, passwort } = body.data;

    const [row] = await deps.db.execute<LookupRow>(
      sql`select id, org_id, passwort_hash, aktiv from anmeldung_benutzer(${email})`,
    );
    const hash = row?.aktiv && row.passwort_hash;
    const passt = await verifyPassword(
      hash || (await getDummyHash()),
      passwort,
    );
    if (!row || !hash || !passt) {
      return reply.code(401).send(FEHLER_ANMELDUNG);
    }

    const profil = await withOrg(deps.db, row.org_id, async (tx) => {
      await tx
        .update(benutzer)
        .set({ letzterLogin: new Date() })
        .where(eq(benutzer.id, row.id));
      return loadProfile(tx, row.id);
    });
    if (!profil) return reply.code(401).send(FEHLER_ANMELDUNG);

    request.session.regenerate();
    request.session.set('benutzerId', row.id);
    request.session.set('orgId', row.org_id);
    return profil;
  });

  app.post('/abmeldung', async (request, reply) => {
    request.session.delete();
    return reply.code(204).send();
  });

  // Alle Routen in diesem Bereich verlangen eine Sitzung und bekommen nur
  // request.mandant.run, also keinen Datenbankzugriff ohne Mandantenkontext.
  await app.register(async (geschuetzt) => {
    geschuetzt.decorateRequest('mandant', null);
    geschuetzt.addHook('preHandler', requireSession(deps.db));

    geschuetzt.get('/sitzung', async (request, reply) => {
      const { benutzerId, run } = request.mandant!;
      const profil = await run((tx) => loadProfile(tx, benutzerId));
      if (!profil) return reply.code(401).send(FEHLER_SITZUNG);
      return profil;
    });
  });
}

function requireSession(db: Db) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const benutzerId = request.session.get('benutzerId');
    const orgId = request.session.get('orgId');
    if (!benutzerId || !orgId) {
      return reply.code(401).send(FEHLER_SITZUNG);
    }
    const run: Mandant['run'] = (work) => withOrg(db, orgId, work);

    // Gelöschte oder deaktivierte Benutzer verlieren die Sitzung sofort.
    // RLS liefert nur Zeilen der Sitzungsorganisation.
    const [row] = await run((tx) =>
      tx
        .select({ aktiv: benutzer.aktiv })
        .from(benutzer)
        .where(eq(benutzer.id, benutzerId)),
    );
    if (!row?.aktiv) {
      request.session.delete();
      return reply.code(401).send(FEHLER_SITZUNG);
    }
    request.mandant = { benutzerId, orgId, run };
  };
}
