# Tagesbericht-Starter

Machbarkeitsnachweis für einen mandantenfähigen digitalen Tagesbericht auf Baustellen. Es ist kein Produkt. Verwendet werden ausschließlich erfundene Demo-Daten, keine Echtdaten.

Stack: TypeScript, React (Vite), Fastify, Drizzle, PostgreSQL 16 mit pgvector, Vitest.

Aktueller Stand: ein lauffähiges Gerüst. Das Backend bietet `GET /health` mit Datenbankprüfung und eine erste Migration (Erweiterung `vector`). Die Startseite zeigt den Status von `/health`.

## Voraussetzungen

- GitHub-Konto mit Codespaces, oder lokal Docker und VS Code mit der Erweiterung „Dev Containers“.
- Alles Weitere (Node 20, PostgreSQL 16 mit pgvector) liefert der Devcontainer.

## Start in wenigen Schritten

1. Repository in einem Codespace öffnen (oder lokal im Devcontainer). Beim Erstellen läuft `scripts/setup-dev.sh`: Es installiert gitleaks, aktiviert den Pre-Commit-Hook und führt `npm ci` aus.
2. Vorlage kopieren und Platzhalter ersetzen:
   ```bash
   cp .env.example .env
   ```
   Benutzer und Passwort frei wählen (beides gilt nur für die lokale Demo-Datenbank) und in `POSTGRES_USER`, `POSTGRES_PASSWORD` und `DATABASE_URL` identisch eintragen.
3. Die Datenbank liest die Werte beim ersten Anlegen. Legst du `.env` erst nach dem Start des Devcontainers an, führe „Rebuild Container“ aus.
4. Datenbank-Migration ausführen:
   ```bash
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

## Qualitätssicherung

- `npm run lint` (ESLint und Prettier), `npm test` (Vitest).
- Pre-Commit-Hook: prüft vor jedem Commit die gestagten Änderungen mit gitleaks auf Zugangsdaten und führt Lint aus. Er wird durch `scripts/setup-dev.sh` aktiviert (`git config core.hooksPath .githooks`). Der Hook wird nicht umgangen.
- GitHub Actions (`.github/workflows/ci.yml`): bei Push und Pull Request Lint, Tests, Migration gegen PostgreSQL mit pgvector und gitleaks über die gesamte Historie.
- Dependabot meldet wöchentlich Updates für npm und GitHub Actions.

## Secrets

- Konfiguration und Zugangsdaten nur über Umgebungsvariablen. Vorlage: `.env.example`. Die Datei `.env` ist von Git ausgeschlossen und wird nie eingecheckt.
- In Codespaces Zugangsdaten als Codespaces-Secrets hinterlegen (Repository-Einstellungen, „Secrets and variables“, „Codespaces“).
