# Tagesbericht-Starter

Machbarkeitsnachweis für einen mandantenfähigen digitalen Tagesbericht auf Baustellen. Es ist kein Produkt. Verwendet werden ausschließlich erfundene Demo-Daten, keine Echtdaten.

Stack: TypeScript, React (Vite), Fastify, Drizzle, PostgreSQL 16 mit pgvector, Vitest.

Aktueller Stand: ein lauffähiges Gerüst mit Mandanten-Grundlage. Das Backend bietet `GET /health` mit Datenbankprüfung. Die Migrationen legen `organisation`, `benutzer` und `einladung` an; `benutzer` und `einladung` sind per Row-Level-Security nach `org_id` getrennt. Die Startseite zeigt den Status von `/health`.

## Voraussetzungen

- GitHub-Konto mit Codespaces, oder lokal Docker und VS Code mit der Erweiterung „Dev Containers“.
- Alles Weitere (Node 20, PostgreSQL 16 mit pgvector) liefert der Devcontainer.

## Start in wenigen Schritten

1. Repository in einem Codespace öffnen (oder lokal im Devcontainer). Beim Erstellen läuft `scripts/setup-dev.sh`: Es installiert gitleaks, aktiviert den Pre-Commit-Hook, führt `npm ci` aus und richtet, falls `.env` vorhanden ist, Datenbankrollen und Migrationen ein.
2. Vorlage kopieren und Platzhalter ersetzen:
   ```bash
   cp .env.example .env
   ```
   Drei Passwörter frei wählen (sie gelten nur für die lokale Demo-Datenbank): Admin (`POSTGRES_USER`, `POSTGRES_PASSWORD`, gleich in `DATABASE_ADMIN_URL`), Migrationsrolle (`DATABASE_MIGRATION_URL`) und Anwendungsrolle (`DATABASE_URL`). Die Rollennamen `tagesbericht_migration` und `tagesbericht_app` bleiben unverändert.
3. Die Datenbank liest `POSTGRES_*` beim ersten Anlegen. Legst du `.env` erst nach dem Start des Devcontainers an, führe „Rebuild Container“ aus.
4. Rollen einrichten und Migrationen ausführen (beides wiederholbar):
   ```bash
   npm run db:rollen -w backend
   npm run db:migrate -w backend
   ```
5. Anwendung starten:
   ```bash
   npm run dev
   ```
6. Frontend im Browser öffnen (Vite, Port siehe Terminalausgabe, meist 5173). Es sollte „Datenbank erreichbar“ anzeigen. Das Backend antwortet unter `http://localhost:3000/health`.

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

| Rolle                    | Zweck                                        | Rechte                                                                                                     |
| ------------------------ | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Admin (`POSTGRES_USER`)  | Superuser des Containers                     | nur `npm run db:rollen`                                                                                    |
| `tagesbericht_migration` | Eigentümerin von Datenbank und Tabellen      | Migrationen; unterliegt wegen `FORCE ROW LEVEL SECURITY` ebenfalls den Policies                            |
| `tagesbericht_app`       | einzige Rolle der Anwendung (`DATABASE_URL`) | kein Superuser, kein BYPASSRLS; `SELECT`, `INSERT`, `UPDATE` auf `benutzer` und `einladung`, kein `DELETE` |

- Die Policies prüfen `org_id` gegen `current_setting('app.current_org')`. Ohne Kontext liefert jede Abfrage keine Zeilen.
- Den Kontext setzt `withOrg(db, orgId, work)` aus `backend/src/db.ts` per `set_config(..., true)` nur für eine Transaktion, damit keine Verbindung aus dem Pool ihn weiterträgt.
- Nichts wird physisch gelöscht (R-5.5): Benutzer werden über `aktiv` deaktiviert.

## Qualitätssicherung

- `npm run lint` (ESLint und Prettier), `npm test` (Vitest). Die Datenbanktests (`backend/src/mandant.db.test.ts`) brauchen eine migrierte Datenbank und laufen gegen die echte PostgreSQL.
- Pre-Commit-Hook: prüft vor jedem Commit die gestagten Änderungen mit gitleaks auf Zugangsdaten und führt Lint aus. Er wird durch `scripts/setup-dev.sh` aktiviert (`git config core.hooksPath .githooks`). Der Hook wird nicht umgangen.
- GitHub Actions (`.github/workflows/ci.yml`): bei Push auf `main` und bei Pull Requests Lint, Einrichtung der Rollen, Migration gegen PostgreSQL mit pgvector, Tests und gitleaks über die gesamte Historie.
- Dependabot meldet wöchentlich Updates für npm und GitHub Actions.

## Secrets

- Konfiguration und Zugangsdaten nur über Umgebungsvariablen. Vorlage: `.env.example`. Die Datei `.env` ist von Git ausgeschlossen und wird nie eingecheckt.
- In Codespaces Zugangsdaten als Codespaces-Secrets hinterlegen (Repository-Einstellungen, „Secrets and variables“, „Codespaces“).
