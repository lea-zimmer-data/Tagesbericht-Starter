#!/usr/bin/env bash
# Einmalige Einrichtung: gitleaks, Pre-Commit-Hook, Abhängigkeiten, Datenbank.
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/install-gitleaks.sh
git config core.hooksPath .githooks
echo "Pre-Commit-Hook aktiv (.githooks)."
npm ci

if [ ! -f .env ]; then
  echo "HINWEIS: .env fehlt. 'cp .env.example .env', Platzhalter ersetzen," >&2
  echo "dann 'npm run db:rollen -w backend' und 'npm run db:migrate -w backend'." >&2
  exit 0
fi
npm run db:rollen -w backend
npm run db:migrate -w backend
