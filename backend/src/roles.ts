// Feste Rollennamen (keine Zugangsdaten). Passwörter kommen nur aus der Umgebung.
// Die Namen stehen auch in den SQL-Migrationen (GRANT) und müssen dazu passen.
export const MIGRATION_ROLE = 'tagesbericht_migration';
export const APP_ROLE = 'tagesbericht_app';
// Ohne Login: besitzt nur die Anmeldefunktion anmeldung_benutzer() (Migration 0005).
export const LOGIN_LOOKUP_ROLE = 'tagesbericht_anmeldung';

export interface RoleCredentials {
  name: string;
  password: string;
}

export function credentialsFromUrl(
  url: string,
  expectedName: string,
  variable: string,
): RoleCredentials {
  const parsed = new URL(url);
  const name = decodeURIComponent(parsed.username);
  const password = decodeURIComponent(parsed.password);
  if (name !== expectedName) {
    throw new Error(
      `${variable} muss den Benutzer ${expectedName} verwenden (gefunden: ${name || 'leer'}).`,
    );
  }
  if (!password) {
    throw new Error(`${variable} enthält kein Passwort.`);
  }
  return { name, password };
}
