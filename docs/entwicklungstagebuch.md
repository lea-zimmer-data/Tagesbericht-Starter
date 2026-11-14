# Entwicklungstagebuch

## Block 1 – Fundament (04.11.2026)

- Datum: 2026-11-04
- Aufgabe: Fundament anlegen: CLAUDE.md (Agenten-Regeln), Devcontainer mit Node 20 und Postgres 16 (pgvector), Compose, .env.example, .gitignore, Doku.
- Vorschlag des Agenten: Compose-basierter Devcontainer mit den Diensten `app` (Node 20) und `db` (`pgvector/pgvector:pg16`); `.env` bleibt außerhalb von Git. Lint und Tests gibt es noch nicht.
- Meine Änderung: Anforderung v1.1 als docs/Anforderung.md abgelegt; `.env` im neuen Codespace von Hand angelegt, danach Rebuild, `db:5432` erreichbar.
