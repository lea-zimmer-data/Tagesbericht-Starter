// Datenbanktests gegen die echte PostgreSQL: Mandantentrennung per RLS (R-4.2).
// Die Anwendung verbindet sich als tagesbericht_app (DATABASE_URL), Testdaten
// für organisation legt die Migrationsrolle an (DATABASE_MIGRATION_URL).
import { randomUUID } from 'node:crypto';
import { eq, inArray, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { parseEnv, postgresUrl } from './config.js';
import { createDb, withOrg } from './db.js';
import { APP_ROLE, MIGRATION_ROLE } from './roles.js';
import { benutzer, einladung, organisation } from './schema.js';

const env = parseEnv(
  z.object({
    DATABASE_URL: postgresUrl('DATABASE_URL'),
    DATABASE_MIGRATION_URL: postgresUrl('DATABASE_MIGRATION_URL'),
  }),
);

const app = createDb(env.DATABASE_URL);
const owner = createDb(env.DATABASE_MIGRATION_URL);

interface Mandant {
  orgId: string;
  benutzerId: string;
  einladungId: string;
}

let a: Mandant;
let b: Mandant;

async function anlegen(name: string): Promise<Mandant> {
  const [org] = await owner.db
    .insert(organisation)
    .values({ name: `Test ${name} ${randomUUID()}` })
    .returning();
  const orgId = org!.id;
  // Fachliche Zeilen legt die Anwendungsrolle im eigenen Kontext an.
  return withOrg(app.db, orgId, async (tx) => {
    const [user] = await tx
      .insert(benutzer)
      .values({
        orgId,
        email: `bauleitung@${name}.example`,
        name: `Bauleitung ${name}`,
        rolle: 'bauleitung',
      })
      .returning();
    const [inv] = await tx
      .insert(einladung)
      .values({
        orgId,
        email: `neu@${name}.example`,
        rolle: 'mitarbeiter',
        tokenHash: randomUUID(),
        gueltigBis: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      })
      .returning();
    return { orgId, benutzerId: user!.id, einladungId: inv!.id };
  });
}

// Drizzle verpackt Datenbankfehler; die Meldung von PostgreSQL steht in cause.
async function fehlerVon(p: Promise<unknown>): Promise<string> {
  try {
    await p;
  } catch (e) {
    const cause = (e as { cause?: unknown }).cause;
    return cause instanceof Error ? cause.message : String(e);
  }
  throw new Error('Erwarteter Datenbankfehler blieb aus');
}

beforeAll(async () => {
  a = await anlegen('a');
  b = await anlegen('b');
});

afterAll(async () => {
  // Aufräumen nur im Test: Die Migrationsrolle unterliegt wegen FORCE ebenfalls
  // der Policy und braucht deshalb je Organisation den Kontext.
  for (const m of [a, b].filter(Boolean)) {
    await withOrg(owner.db, m.orgId, async (tx) => {
      await tx.delete(einladung).where(eq(einladung.orgId, m.orgId));
      await tx.delete(benutzer).where(eq(benutzer.orgId, m.orgId));
    });
  }
  await owner.db.delete(organisation).where(
    inArray(
      organisation.id,
      [a, b].filter(Boolean).map((m) => m.orgId),
    ),
  );
  await Promise.all([app.close(), owner.close()]);
});

describe('ohne Mandantenkontext', () => {
  it('sind benutzer und einladung leer', async () => {
    expect(await app.db.select().from(benutzer)).toEqual([]);
    expect(await app.db.select().from(einladung)).toEqual([]);
  });

  it('sind sie auch auf einer Verbindung leer, die vorher Kontext hatte', async () => {
    const single = createDb(env.DATABASE_URL, { max: 1 });
    try {
      await withOrg(single.db, a.orgId, async (tx) => {
        expect(await tx.select().from(benutzer)).toHaveLength(1);
      });
      // Nach der Transaktion ist die Einstellung '' statt NULL.
      const [row] = await single.db.execute<{ org: string | null }>(
        sql`select current_setting('app.current_org', true) as org`,
      );
      expect(row?.org).toBe('');
      expect(await single.db.select().from(benutzer)).toEqual([]);
      expect(await single.db.select().from(einladung)).toEqual([]);
    } finally {
      await single.close();
    }
  });

  it('lehnt ungültige orgId in withOrg ab', async () => {
    await expect(withOrg(app.db, 'keine-uuid', async () => 1)).rejects.toThrow(
      /orgId/,
    );
  });
});

describe('Primärschlüssel', () => {
  it('sind UUIDv7', () => {
    const v7 =
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
    for (const m of [a, b]) {
      expect(m.orgId).toMatch(v7);
      expect(m.benutzerId).toMatch(v7);
      expect(m.einladungId).toMatch(v7);
    }
  });
});

describe('mit Kontext Organisation A', () => {
  it('sieht nur die eigenen Zeilen (Positivkontrolle)', async () => {
    await withOrg(app.db, a.orgId, async (tx) => {
      const users = await tx.select().from(benutzer);
      const invs = await tx.select().from(einladung);
      expect(users.map((u) => u.id)).toEqual([a.benutzerId]);
      expect(invs.map((i) => i.id)).toEqual([a.einladungId]);
    });
  });

  it('kann Zeilen von B nicht lesen', async () => {
    await withOrg(app.db, a.orgId, async (tx) => {
      expect(
        await tx.select().from(benutzer).where(eq(benutzer.id, b.benutzerId)),
      ).toEqual([]);
      expect(
        await tx
          .select()
          .from(einladung)
          .where(eq(einladung.id, b.einladungId)),
      ).toEqual([]);
    });
  });

  it('kann Zeilen von B nicht ändern', async () => {
    await withOrg(app.db, a.orgId, async (tx) => {
      expect(
        await tx
          .update(benutzer)
          .set({ name: 'übernommen', aktiv: false })
          .where(eq(benutzer.id, b.benutzerId))
          .returning(),
      ).toEqual([]);
      expect(
        await tx
          .update(einladung)
          .set({ eingeloestAm: new Date() })
          .where(eq(einladung.id, b.einladungId))
          .returning(),
      ).toEqual([]);
    });
    await withOrg(app.db, b.orgId, async (tx) => {
      const [user] = await tx
        .select()
        .from(benutzer)
        .where(eq(benutzer.id, b.benutzerId));
      const [inv] = await tx
        .select()
        .from(einladung)
        .where(eq(einladung.id, b.einladungId));
      expect(user).toMatchObject({ name: 'Bauleitung b', aktiv: true });
      expect(inv?.eingeloestAm).toBeNull();
    });
  });

  it('kann Zeilen von B nicht löschen', async () => {
    for (const [table, id] of [
      [benutzer, b.benutzerId],
      [einladung, b.einladungId],
    ] as const) {
      const meldung = await fehlerVon(
        withOrg(app.db, a.orgId, (tx) =>
          tx.delete(table).where(eq(table.id, id)),
        ),
      );
      expect(meldung).toMatch(/permission denied/);
    }
    await withOrg(app.db, b.orgId, async (tx) => {
      expect(await tx.select().from(benutzer)).toHaveLength(1);
      expect(await tx.select().from(einladung)).toHaveLength(1);
    });
  });

  it('kann keine Zeilen mit org_id von B anlegen oder dorthin verschieben', async () => {
    const anlegen = await fehlerVon(
      withOrg(app.db, a.orgId, (tx) =>
        tx.insert(benutzer).values({
          orgId: b.orgId,
          email: 'fremd@a.example',
          name: 'Fremd',
          rolle: 'mitarbeiter',
        }),
      ),
    );
    expect(anlegen).toMatch(/row-level security/);

    const verschieben = await fehlerVon(
      withOrg(app.db, a.orgId, (tx) =>
        tx
          .update(einladung)
          .set({ orgId: b.orgId })
          .where(eq(einladung.id, a.einladungId)),
      ),
    );
    expect(verschieben).toMatch(/row-level security/);
  });
});

describe('Anwendungsrolle', () => {
  it('ist weder Superuser noch hat sie BYPASSRLS', async () => {
    const [row] = await app.db.execute<{
      rolname: string;
      rolsuper: boolean;
      rolbypassrls: boolean;
    }>(
      sql`select rolname, rolsuper, rolbypassrls from pg_roles where rolname = current_user`,
    );
    expect(row).toEqual({
      rolname: APP_ROLE,
      rolsuper: false,
      rolbypassrls: false,
    });
  });

  it('ist nicht Eigentümerin; RLS ist aktiv und erzwungen', async () => {
    const rows = await app.db.execute<{
      relname: string;
      owner: string;
      relrowsecurity: boolean;
      relforcerowsecurity: boolean;
    }>(sql`
      select relname, pg_get_userbyid(relowner) as owner,
             relrowsecurity, relforcerowsecurity
      from pg_class
      where relname in ('benutzer', 'einladung') and relkind = 'r'
      order by relname`);
    expect([...rows]).toEqual([
      {
        relname: 'benutzer',
        owner: MIGRATION_ROLE,
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
      {
        relname: 'einladung',
        owner: MIGRATION_ROLE,
        relrowsecurity: true,
        relforcerowsecurity: true,
      },
    ]);
  });

  it('kann RLS nicht per row_security = off abschalten', async () => {
    const meldung = await fehlerVon(
      withOrg(app.db, a.orgId, async (tx) => {
        await tx.execute(sql`set local row_security = off`);
        return tx.select().from(benutzer);
      }),
    );
    expect(meldung).toMatch(/row-level security/);
  });

  it('hat keinen Zugriff auf organisation', async () => {
    const meldung = await fehlerVon(app.db.select().from(organisation));
    expect(meldung).toMatch(/permission denied/);
  });
});
