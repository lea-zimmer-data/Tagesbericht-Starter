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
- Meine Änderung: Auftrag um fünf Aufräumarbeiten ergänzt (Tagebuch, README, Endtermin 23.01.2027, Devcontainer-Erweiterung, Umbenennung). Plan gelesen und freigegeben. Abnahme selbst durchgeführt: Lint und Tests grün, Seite zeigt „Datenbank erreichbar“, Migration auf zurückgesetzter Datenbank mit Ergebnis plpgsql und vector. Für die Migrationsprüfung manuelle Freigabe gewählt, weil die Datenbank zurückgesetzt wird.

## Block 3 – Absicherung (14.11.2026)

- Datum: 2026-11-14
- Aufgabe: Automatische Prüfungen und Schutz vor eingecheckten Zugangsdaten: GitHub Actions, Pre-Commit-Hook, Dependabot, README; Tagebuch bereinigt.
- Vorschlag des Agenten: Hook ohne neue npm-Abhängigkeit über `core.hooksPath` und `.githooks/pre-commit`; gitleaks als fest versioniertes, per Prüfsumme geprüftes CLI-Binary (kein Lizenzschlüssel), installiert über `scripts/setup-dev.sh` im Devcontainer. CI mit Node 20 und pgvector-Dienst, gitleaks als CLI.
- Meine Änderung: Den Sicherheitstest im Prompt angepasst: erfundener Schlüssel, den gitleaks wirklich erkennt, weil Werte mit „EXAMPLE“ bewusst ausgenommen werden. Zusätzlich das Tagebuch bereinigen lassen (versehentlich eingefügter Pull-Request-Text). Pipeline im Pull Request war grün, danach gemergt. Alle Tests frei gegeben.

## Aufräumblock (17.11.2026)

- Datum: 2026-11-17
- Aufgabe: Aufräumen vor AP-B. KI-Anbieter in der Anforderung von Azure OpenAI (Entra ID) auf Mistral umstellen (La Plateforme, EU-Verarbeitung, Experiment-Tarif; neues Abnahmekriterium „eigene Schnittstelle“ bei F-15, NF-8 angepasst, neue NF-11 „kostenloser Tarif nur mit Demo-Daten“, Hinweis zur Vektorlänge bei `bericht_embedding`). Markdown-Formatierung der Anforderung wiederherstellen. Containerpfad auf `/workspaces/Tagesbericht-Starter` umstellen. Frontend-Test für die Health-Anzeige wieder einbauen, aber nur ohne schwere Abhängigkeiten.
- Vorschlag des Agenten: Erst Plan, dann je ein Commit pro Schritt. Formatierung per Skript umgestellt und den Wortlaut gegen die Vorfassung verglichen. Pfadänderung braucht „Rebuild Container“; das Volume `pgdata` bleibt erhalten. Frontend-Test ohne jsdom und Testing Library: Abruflogik als `loadHealthState` ausgelagert und mit gestubbtem `fetch` getestet, Anfangszustand über `renderToString`. Einzige Ergänzung ist `vitest` 4.1.12 im Frontend (schon im Lockfile). Grenze: Der Textwechsel nach dem Laden wird nicht im DOM geprüft.
- Meine Änderung: Plan ohne Änderungen freigegeben.
