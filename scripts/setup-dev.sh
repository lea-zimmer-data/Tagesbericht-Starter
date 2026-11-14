#!/usr/bin/env bash
# Einmalige Einrichtung: gitleaks, Pre-Commit-Hook, Abhängigkeiten.
set -euo pipefail
cd "$(dirname "$0")/.."

bash scripts/install-gitleaks.sh
git config core.hooksPath .githooks
echo "Pre-Commit-Hook aktiv (.githooks)."
npm ci
