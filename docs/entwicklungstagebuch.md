# Entwicklungstagebuch

## Block 1 – Fundament (04.11.2026)

- Datum: 2026-11-04
- Aufgabe: Fundament anlegen: CLAUDE.md (Agenten-Regeln), Devcontainer mit Node 20 und Postgres 16 (pgvector), Compose, .env.example, .gitignore, Doku.
- Vorschlag des Agenten: Compose-basierter Devcontainer mit den Diensten `app` (Node 20) und `db` (`pgvector/pgvector:pg16`); `.env` bleibt außerhalb von Git. Lint und Tests gibt es noch nicht.
- Meine Änderung: Anforderung v1.1 als docs/Anforderung.md abgelegt; `.env` im neuen Codespace von Hand angelegt, danach Rebuild, `db:5432` erreichbar.

## Block 2 – Gerüst (14.11.2026)

- Datum: 2026-11-14
- Aufgabe: Lauffähiges Gerüst aus Backend (Fastify, Drizzle) und Frontend (Vite, React) als npm-Workspaces-Monorepo; dazu fünf kleine Aufräumarbeiten (Tagebuch, README, Termin in der Anforderung, Devcontainer-Erweiterung, Umbenennung).
- Vorschlag des Agenten: Erst Plan, dann je ein kleiner Commit pro Schritt. Konfigurationsprüfung mit Zod, `GET /health` mit Datenbankcheck, erste Migration nur mit `CREATE EXTENSION vector`, Startseite ruft `/health` über den Vite-Proxy ab. Dev-Start ohne Zusatzabhängigkeit über Shell-Hintergrundprozesse.
- Meine Änderung: _offen_ (nach Durchsicht eintragen). Hinweis: Der alte Name „Bau-App-Demo" steht nur noch in `workspaceFolder` und im Compose-Mount, weil der Ordner im Codespace so heißt.

- ## Was ist neu
- Monorepo mit npm workspaces: backend/, frontend/, docs/
- Backend: Fastify mit TypeScript, GET /health prüft die Datenbank, Drizzle mit erster Migration (Erweiterung vector), Konfigurationsprüfung beim Start
- Frontend: Vite, React, TypeScript; die Startseite zeigt den Status von /health
- ESLint, Prettier, TypeScript strict, Vitest mit Tests für Health-Route und Konfiguration
- Aufräumen: Entwicklungstagebuch zusammengeführt, README ergänzt, Repo-Name angepasst, Erweiterung anthropic.claude-code im Devcontainer, Endtermin in der Anforderung auf 23.01.2027

## Abnahme
- [x] npm run lint und npm test laufen grün
- [x] Backend und Frontend starten, die Seite zeigt "Datenbank erreichbar"
- [x] Migration läuft auf einer leeren Datenbank durch

## Hinweise
- Keine Zugangsdaten im Code, .env bleibt ignoriert
- Weiter mit Block 3: GitHub Actions, Pre-Commit-Hook, README
