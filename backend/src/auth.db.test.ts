// Anmeldung und Mandantenkontext gegen die echte PostgreSQL (F-01, R-4.2).
// Die App läuft als tagesbericht_app; Organisationen legt die Migrationsrolle an.
import { randomBytes, randomUUID } from 'node:crypto';
import secureSession from '@fastify/secure-session';
import Fastify from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { buildApp } from './app.js';
import { SESSION_COOKIE } from './auth.js';
import { parseEnv, postgresUrl } from './config.js';
import { createDb, withOrg } from './db.js';
import { hashPassword } from './password.js';
import { benutzer, organisation } from './schema.js';

const env = parseEnv(
  z.object({
    DATABASE_URL: postgresUrl('DATABASE_URL'),
    DATABASE_MIGRATION_URL: postgresUrl('DATABASE_MIGRATION_URL'),
  }),
);

const appDb = createDb(env.DATABASE_URL);
const owner = createDb(env.DATABASE_MIGRATION_URL);
// Wegwerfschlüssel nur für diesen Testlauf.
const sessionKey = randomBytes(32).toString('hex');
const app = buildApp({
  checkDb: appDb.checkDb,
  api: { db: appDb.db, sessionKey, secureCookie: true },
});

// Erfundenes Testpasswort, wird pro Lauf zufällig erzeugt.
const passwort = randomBytes(12).toString('base64url');
const suffix = randomUUID().slice(0, 8);

interface Konto {
  orgId: string;
  orgName: string;
  benutzerId: string;
  email: string;
  name: string;
}
let a: Konto;
let b: Konto;
let inaktivEmail: string;
const orgIds: string[] = [];

async function anlegen(kurz: string, aktiv = true): Promise<Konto> {
  const orgName = `Auth-Test ${kurz} ${suffix}`;
  const [org] = await owner.db
    .insert(organisation)
    .values({ name: orgName })
    .returning();
  orgIds.push(org!.id);
  const email = `bauleitung-${suffix}@${kurz}.example`;
  const name = `Bauleitung ${kurz}`;
  const passwortHash = await hashPassword(passwort);
  const [user] = await withOrg(appDb.db, org!.id, (tx) =>
    tx
      .insert(benutzer)
      .values({
        orgId: org!.id,
        email,
        name,
        rolle: 'bauleitung',
        passwortHash,
        aktiv,
      })
      .returning(),
  );
  return { orgId: org!.id, orgName, benutzerId: user!.id, email, name };
}

function login(email: string, pw: string) {
  return app.inject({
    method: 'POST',
    url: '/api/anmeldung',
    payload: { email, passwort: pw },
  });
}

function sitzungMit(cookie?: string) {
  return app.inject({
    method: 'GET',
    url: '/api/sitzung',
    cookies: cookie ? { [SESSION_COOKIE]: cookie } : {},
  });
}

function sessionCookie(res: Awaited<ReturnType<typeof login>>) {
  return res.cookies.find((c) => c.name === SESSION_COOKIE);
}

// Erzeugt ein gültig verschlüsseltes Cookie mit beliebigem Inhalt (Test hat den Schlüssel).
async function cookieMit(data: { benutzerId: string; orgId: string }) {
  const helper = Fastify();
  await helper.register(secureSession, {
    key: Buffer.from(sessionKey, 'hex'),
    cookieName: SESSION_COOKIE,
  });
  helper.get('/', async (request) => {
    request.session.set('benutzerId', data.benutzerId);
    request.session.set('orgId', data.orgId);
    return 'ok';
  });
  const res = await helper.inject({ method: 'GET', url: '/' });
  await helper.close();
  return sessionCookie(res)!.value;
}

beforeAll(async () => {
  a = await anlegen('a');
  b = await anlegen('b');
  inaktivEmail = (await anlegen('inaktiv', false)).email;
});

afterAll(async () => {
  await app.close();
  for (const orgId of orgIds) {
    await withOrg(owner.db, orgId, (tx) =>
      tx.delete(benutzer).where(eq(benutzer.orgId, orgId)),
    );
  }
  if (orgIds.length) {
    await owner.db.delete(organisation).where(inArray(organisation.id, orgIds));
  }
  await Promise.all([appDb.close(), owner.close()]);
});

describe('POST /api/anmeldung', () => {
  it('meldet mit richtigem Passwort an und setzt ein sicheres Cookie', async () => {
    const res = await login(a.email, passwort);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({
      name: a.name,
      email: a.email,
      rolle: 'bauleitung',
      organisation: { name: a.orgName },
    });
    const cookie = sessionCookie(res);
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'Strict',
      secure: true,
      path: '/api',
      maxAge: 8 * 3600,
    });
    // Das Cookie enthält keine lesbaren Daten.
    expect(cookie!.value).not.toContain(a.benutzerId);

    const [row] = await withOrg(appDb.db, a.orgId, (tx) =>
      tx
        .select({ letzterLogin: benutzer.letzterLogin })
        .from(benutzer)
        .where(eq(benutzer.id, a.benutzerId)),
    );
    expect(row!.letzterLogin).toBeInstanceOf(Date);
  });

  it('findet die E-Mail ohne Groß- und Kleinschreibung', async () => {
    const res = await login(a.email.toUpperCase(), passwort);
    expect(res.statusCode).toBe(200);
  });

  it.each([
    ['falsches Passwort', () => login(a.email, `${passwort}x`)],
    ['unbekannte E-Mail', () => login(`niemand-${suffix}@a.example`, passwort)],
    ['deaktivierter Benutzer', () => login(inaktivEmail, passwort)],
  ])('lehnt ab: %s (401, gleiche Meldung, kein Cookie)', async (_, versuch) => {
    const res = await versuch();
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ fehler: 'E-Mail oder Passwort falsch' });
    expect(sessionCookie(res)).toBeUndefined();
  });

  it('lehnt leere Eingaben mit 400 ab', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/anmeldung',
      payload: { email: '', passwort: '' },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe('Zugriff ohne gültige Sitzung', () => {
  it('lehnt GET /api/sitzung ohne Cookie ab', async () => {
    const res = await sitzungMit();
    expect(res.statusCode).toBe(401);
    expect(res.json()).toEqual({ fehler: 'Nicht angemeldet' });
  });

  it('lehnt ein manipuliertes Cookie ab', async () => {
    const echt = sessionCookie(await login(a.email, passwort))!.value;
    const kaputt = `${echt.slice(0, -4)}AAAA`;
    expect((await sitzungMit(kaputt)).statusCode).toBe(401);
  });

  it('löscht das Cookie beim Abmelden', async () => {
    const echt = sessionCookie(await login(a.email, passwort))!.value;
    const res = await app.inject({
      method: 'POST',
      url: '/api/abmeldung',
      cookies: { [SESSION_COOKIE]: echt },
    });
    expect(res.statusCode).toBe(204);
    const geloescht = sessionCookie(res)!;
    expect(geloescht.value).toBe('');
    expect(geloescht.maxAge).toBe(0);
    expect((await sitzungMit(geloescht.value)).statusCode).toBe(401);
  });
});

describe('Mandantenkontext aus der Sitzung', () => {
  it('liefert nach Anmeldung als A Benutzer und Organisation A, als B die von B', async () => {
    for (const konto of [a, b]) {
      const cookie = sessionCookie(await login(konto.email, passwort))!.value;
      const res = await sitzungMit(cookie);
      expect(res.statusCode).toBe(200);
      // organisation ist nur über die Policy id = app.current_org lesbar.
      expect(res.json()).toEqual({
        name: konto.name,
        email: konto.email,
        rolle: 'bauleitung',
        organisation: { name: konto.orgName },
      });
    }
  });

  it('nutzt orgId der Sitzung: Benutzer A mit orgId B findet nichts (401)', async () => {
    const cookie = await cookieMit({
      benutzerId: a.benutzerId,
      orgId: b.orgId,
    });
    expect((await sitzungMit(cookie)).statusCode).toBe(401);
  });

  it('akzeptiert ein selbst verschlüsseltes Cookie mit passender orgId', async () => {
    const cookie = await cookieMit({
      benutzerId: b.benutzerId,
      orgId: b.orgId,
    });
    const res = await sitzungMit(cookie);
    expect(res.statusCode).toBe(200);
    expect(res.json().organisation).toEqual({ name: b.orgName });
  });

  it('beendet die Sitzung, wenn der Benutzer deaktiviert wird', async () => {
    const tmp = await anlegen('tmp');
    const cookie = sessionCookie(await login(tmp.email, passwort))!.value;
    expect((await sitzungMit(cookie)).statusCode).toBe(200);
    await withOrg(appDb.db, tmp.orgId, (tx) =>
      tx
        .update(benutzer)
        .set({ aktiv: false })
        .where(eq(benutzer.id, tmp.benutzerId)),
    );
    expect((await sitzungMit(cookie)).statusCode).toBe(401);
  });
});
