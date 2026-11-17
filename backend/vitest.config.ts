import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Lokal kommen die Datenbank-URLs aus ../.env, in der CI aus der Umgebung.
// Bereits gesetzte Variablen werden nicht überschrieben.
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  test: {},
});
