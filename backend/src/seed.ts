// Demo-Daten (F-01): zwei erfundene Organisationen mit je einer Bauleitung und
// drei Mitarbeitern. Wiederholbar: feste IDs und E-Mails, Upsert statt Insert.
//
// Rollen:
// - organisation legt tagesbericht_migration an (DATABASE_MIGRATION_URL). Sie
//   ist Eigentümerin; tagesbericht_app hat dort nur SELECT.
// - benutzer legt tagesbericht_app im Kontext der Organisation an
//   (DATABASE_URL, withOrg), also auf demselben Weg wie die Anwendung.
//
// Passwörter stehen nicht im Repo: DEMO_PASSWORT (für alle) oder je Benutzer
// ein Zufallswert. Jeder Lauf setzt sie neu und gibt sie einmal aus.
import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { parseEnv, postgresUrl } from './config.js';
import { createDb, withOrg } from './db.js';
import { hashPassword } from './password.js';

type Rolle = 'bauleitung' | 'mitarbeiter';

interface DemoOrg {
  id: string;
  name: string;
  anschrift: string;
  benutzer: { name: string; email: string; rolle: Rolle }[];
}

// Alles erfunden. Feste UUIDv7, damit ein zweiter Lauf dieselben Zeilen trifft.
const demo: DemoOrg[] = [
  {
    id: '019a0000-0000-7000-8000-000000000001',
    name: 'Hochbau Morgenrot GmbH',
    anschrift: 'Sonnenstraße 12, 10115 Beispielstadt',
    benutzer: [
      {
        name: 'Henrike Sommerfeld',
        email: 'henrike.sommerfeld@morgenrot.example',
        rolle: 'bauleitung',
      },
      {
        name: 'Jonas Kerber',
        email: 'jonas.kerber@morgenrot.example',
        rolle: 'mitarbeiter',
      },
      {
        name: 'Mira Albrecht',
        email: 'mira.albrecht@morgenrot.example',
        rolle: 'mitarbeiter',
      },
      {
        name: 'Emil Vogtmann',
        email: 'emil.vogtmann@morgenrot.example',
        rolle: 'mitarbeiter',
      },
    ],
  },
  {
    id: '019a0000-0000-7000-8000-000000000002',
    name: 'Tiefbau Lindenfeld KG',
    anschrift: 'Am Lindenhang 3, 20095 Musterhafen',
    benutzer: [
      {
        name: 'Konrad Wiesner',
        email: 'konrad.wiesner@lindenfeld.example',
        rolle: 'bauleitung',
      },
      {
        name: 'Lena Hofstetter',
        email: 'lena.hofstetter@lindenfeld.example',
        rolle: 'mitarbeiter',
      },
      {
        name: 'Paul Brückner',
        email: 'paul.brueckner@lindenfeld.example',
        rolle: 'mitarbeiter',
      },
      {
        name: 'Selin Arda',
        email: 'selin.arda@lindenfeld.example',
        rolle: 'mitarbeiter',
      },
    ],
  },
];

const env = parseEnv(
  z.object({
    DATABASE_URL: postgresUrl('DATABASE_URL'),
    DATABASE_MIGRATION_URL: postgresUrl('DATABASE_MIGRATION_URL'),
    DEMO_PASSWORT: z
      .string()
      .optional()
      .transform((v) => v || undefined)
      .pipe(
        z
          .string()
          .min(12, { message: 'DEMO_PASSWORT braucht mindestens 12 Zeichen' })
          .optional(),
      ),
  }),
);

const owner = createDb(env.DATABASE_MIGRATION_URL, { max: 1 });
const app = createDb(env.DATABASE_URL, { max: 1 });
const ausgabe: {
  organisation: string;
  email: string;
  rolle: Rolle;
  passwort: string;
}[] = [];

try {
  for (const org of demo) {
    await owner.db.execute(sql`
      insert into organisation (id, name, anschrift)
      values (${org.id}, ${org.name}, ${org.anschrift})
      on conflict (id) do update
        set name = excluded.name, anschrift = excluded.anschrift`);

    await withOrg(app.db, org.id, async (tx) => {
      for (const b of org.benutzer) {
        const passwort =
          env.DEMO_PASSWORT ?? randomBytes(12).toString('base64url');
        const hash = await hashPassword(passwort);
        await tx.execute(sql`
          insert into benutzer (org_id, email, name, rolle, passwort_hash, aktiv)
          values (${org.id}, ${b.email}, ${b.name}, ${b.rolle}, ${hash}, true)
          on conflict (lower(email)) do update
            set name = excluded.name, rolle = excluded.rolle,
                passwort_hash = excluded.passwort_hash, aktiv = true`);
        ausgabe.push({
          organisation: org.name,
          email: b.email,
          rolle: b.rolle,
          passwort: env.DEMO_PASSWORT ? '(DEMO_PASSWORT)' : passwort,
        });
      }
    });
  }

  console.log(
    `Demo-Daten angelegt: ${demo.length} Organisationen, ${ausgabe.length} Benutzer.`,
  );
  console.log(
    'Passwörter gelten bis zum nächsten Lauf und werden nirgends gespeichert:',
  );
  console.table(ausgabe);
} finally {
  await Promise.all([owner.close(), app.close()]);
}
