# Tagesbericht-Starter

Machbarkeitsnachweis für einen mandantenfähigen digitalen Tagesbericht auf Baustellen. Es ist kein Produkt. Verwendet werden ausschließlich erfundene Demo-Daten, keine Echtdaten.

Stack: TypeScript, React (Vite), Fastify, Drizzle, PostgreSQL 16 mit pgvector, Vitest.

Aktueller Stand: Mandanten-Grundlage mit Anmeldung (F-01). Das Backend bietet `GET /health` mit Datenbankprüfung sowie Anmeldung, Abmeldung und Sitzung unter `/api`. Die Migrationen legen `organisation`, `benutzer` und `einladung` an, alle per Row-Level-Security nach Organisation getrennt. `npm run seed` legt zwei Demo-Organisationen an. Die Startseite zeigt den Status von `/health`, eine Anmeldeseite und danach Name, Rolle und Organisation.

## Voraussetzungen

- GitHub-Konto mit Codespaces, oder lokal Docker und VS Code mit der Erweiterung „Dev Containers“.
- Alles Weitere (Node 20, PostgreSQL 16 mit pgvector) liefert der Devcontainer.

## Start in wenigen Schritten

1. Repository in einem Codespace öffnen (oder lokal im Devcontainer). Beim Erstellen läuft `scripts/setup-dev.sh`: Es installiert gitleaks, aktiviert den Pre-Commit-Hook, führt `npm ci` aus und richtet, falls `.env` vorhanden ist, Datenbankrollen und Migrationen ein.
2. Vorlage kopieren und Platzhalter ersetzen:
   ```bash
   cp .env.example .env
   ```
   Drei Passwörter frei wählen (sie gelten nur für die lokale Demo-Datenbank): Admin (`POSTGRES_USER`, `POSTGRES_PASSWORD`, gleich in `DATABASE_ADMIN_URL`), Migrationsrolle (`DATABASE_MIGRATION_URL`) und Anwendungsrolle (`DATABASE_URL`). Die Rollennamen `tagesbericht_migration` und `tagesbericht_app` bleiben unverändert. Dazu einen `SESSION_KEY` erzeugen (Befehl steht in `.env.example`).
3. Die Datenbank liest `POSTGRES_*` beim ersten Anlegen. Legst du `.env` erst nach dem Start des Devcontainers an, führe „Rebuild Container“ aus.
4. Rollen einrichten und Migrationen ausführen (beides wiederholbar):
   ```bash
   npm run db:rollen -w backend
   npm run db:migrate -w backend
   ```
5. Demo-Daten anlegen (wiederholbar):
   ```bash
   npm run seed
   ```
   Das Skript gibt E-Mail-Adressen und Passwörter der Demo-Benutzer einmal auf der Konsole aus. Ist `DEMO_PASSWORT` gesetzt, gilt dieses Passwort für alle, sonst erzeugt jeder Lauf neue Zufallspasswörter.
6. Anwendung starten:
   ```bash
   npm run dev
   ```
7. Frontend im Browser öffnen (Vite, Port siehe Terminalausgabe, meist 5173). Es sollte „Datenbank erreichbar“ und die Anmeldeseite anzeigen. Mit einem Demo-Konto anmelden. Das Backend antwortet unter `http://localhost:3000/health`, Vite leitet `/health` und `/api` dorthin weiter.

Ohne Codespaces (Devcontainer lokal, aber ohne automatisches Setup): einmal `bash scripts/setup-dev.sh` ausführen.

## Projektstruktur

| Pfad                                   | Inhalt                                                 |
| -------------------------------------- | ------------------------------------------------------ |
| `backend/`                             | Fastify-Server, Drizzle-Schema, SQL-Migrationen, Tests |
| `frontend/`                            | React-Startseite mit Vite                              |
| `docs/`                                | Anforderung und Entwicklungstagebuch                   |
| `.githooks/`                           | Pre-Commit-Hook                                        |
| `scripts/`                             | Einrichtung (`setup-dev.sh`) und gitleaks-Installation |
| `.github/`                             | CI-Workflow und Dependabot-Konfiguration               |
| `.devcontainer/`, `docker-compose.yml` | Entwicklungsumgebung mit PostgreSQL                    |

## Datenbankrollen und Mandantentrennung

| Rolle                    | Zweck                                        | Rechte                                                                                                                                                                            |
| ------------------------ | -------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin (`POSTGRES_USER`)  | Superuser des Containers                     | nur `npm run db:rollen`                                                                                                                                                           |
| `tagesbericht_migration` | Eigentümerin von Datenbank und Tabellen      | Migrationen, legt in `npm run seed` die Organisationen an; unterliegt bei `benutzer` und `einladung` wegen `FORCE ROW LEVEL SECURITY` ebenfalls den Policies                      |
| `tagesbericht_app`       | einzige Rolle der Anwendung (`DATABASE_URL`) | kein Superuser, kein BYPASSRLS; `SELECT`, `INSERT`, `UPDATE` auf `benutzer` und `einladung`, kein `DELETE`; nur `SELECT` auf `organisation`; `EXECUTE` auf `anmeldung_benutzer()` |
| `tagesbericht_anmeldung` | Eigentümerin der Anmeldefunktion, ohne Login | `SELECT` auf die Spalten `id`, `org_id`, `email`, `passwort_hash`, `aktiv` von `benutzer`, eigene Policy nur für diese Rolle                                                      |

- Die Policies prüfen `org_id` gegen `current_setting('app.current_org')`. Ohne Kontext liefert jede Abfrage keine Zeilen.
- Den Kontext setzt `withOrg(db, orgId, work)` aus `backend/src/db.ts` per `set_config(..., true)` nur für eine Transaktion, damit keine Verbindung aus dem Pool ihn weiterträgt.
- `organisation`: Policy `id = app.current_org`, nur `SELECT` für die Anwendung. RLS ist aktiv, aber ohne `FORCE`, damit die Eigentümerin Organisationen anlegen kann.
- Nichts wird physisch gelöscht (R-5.5): Benutzer werden über `aktiv` deaktiviert.

## Anmeldung und Sitzung

- `POST /api/anmeldung` (`{ email, passwort }`), `POST /api/abmeldung`, `GET /api/sitzung` (Name, E-Mail, Rolle, Organisation).
- Passwörter als Argon2id-Hash (`argon2`, NF-9). Die E-Mail ist global eindeutig, ohne Unterschied zwischen Groß- und Kleinschreibung.
- Vor dem Login ist die Organisation unbekannt. Deshalb sucht die Anwendung den Benutzer nur über `anmeldung_benutzer(email)`. Diese Funktion läuft mit SECURITY DEFINER als `tagesbericht_anmeldung` und liefert höchstens eine Zeile (ID, Organisation, Hash, aktiv). Die RLS von `tagesbericht_app` bleibt unverändert.
- Unbekannte E-Mail, falsches Passwort und deaktivierter Benutzer liefern dieselbe Antwort (401). Auch bei unbekannter E-Mail läuft eine Argon2-Prüfung.
- Sitzung: verschlüsseltes Cookie `sitzung` (`@fastify/secure-session`) mit `benutzerId` und `orgId`; `HttpOnly`, `SameSite=Strict`, Pfad `/api`, 8 Stunden; `Secure` außer bei `NODE_ENV=development` (`npm run dev`).
- Jede geschützte Route bekommt nur `request.mandant.run(...)`. Das ist `withOrg()` mit der `orgId` der Sitzung, ein Zugriff ohne Mandantenkontext ist nicht vorgesehen. Bei jeder Anfrage wird geprüft, ob der Benutzer noch aktiv ist.
- Grenze: Die Sitzung liegt nur im Cookie. Abmelden löscht das Cookie im Browser, eine vorher kopierte Kopie bleibt aber bis zum Ablauf (höchstens 8 Stunden) gültig. Sofort ungültig wird sie nur, wenn der Benutzer deaktiviert wird.
- Nicht gebaut: Begrenzung von Login-Versuchen, Passwort ändern, Einladungen (F-02).

## Qualitätssicherung

- `npm run lint` (ESLint und Prettier), `npm test` (Vitest). Die Datenbanktests (`backend/src/*.db.test.ts`) brauchen eine migrierte Datenbank und laufen gegen die echte PostgreSQL.
- Pre-Commit-Hook: prüft vor jedem Commit die gestagten Änderungen mit gitleaks auf Zugangsdaten und führt Lint aus. Er wird durch `scripts/setup-dev.sh` aktiviert (`git config core.hooksPath .githooks`). Der Hook wird nicht umgangen.
- GitHub Actions (`.github/workflows/ci.yml`): bei Push auf `main` und bei Pull Requests Lint, Einrichtung der Rollen, Migration gegen PostgreSQL mit pgvector, Tests und gitleaks über die gesamte Historie.
- Dependabot meldet wöchentlich Updates für npm und GitHub Actions.

## Secrets

- Konfiguration und Zugangsdaten nur über Umgebungsvariablen. Vorlage: `.env.example`. Die Datei `.env` ist von Git ausgeschlossen und wird nie eingecheckt.
- In Codespaces Zugangsdaten als Codespaces-Secrets hinterlegen (Repository-Einstellungen, „Secrets and variables“, „Codespaces“).
