import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const url = 'postgres://user:pw@localhost:5432/db';
// Erfundener Testwert, kein echter Schlüssel.
const key = '0'.repeat(64);
const base = { DATABASE_URL: url, SESSION_KEY: key };

describe('loadConfig', () => {
  it('liefert Werte und Standardwerte bei gültiger Eingabe', () => {
    const config = loadConfig(base);
    expect(config).toEqual({
      DATABASE_URL: url,
      PORT: 3000,
      HOST: '0.0.0.0',
      SESSION_KEY: key,
      secureCookie: true,
    });
  });

  it('übernimmt PORT aus der Umgebung als Zahl', () => {
    expect(loadConfig({ ...base, PORT: '4000' }).PORT).toBe(4000);
  });

  it('nennt fehlende Variable beim Namen', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('lehnt Platzhalter-URL ab', () => {
    expect(() =>
      loadConfig({
        ...base,
        DATABASE_URL: 'postgres://<benutzer>:pw@db/<datenbank>',
      }),
    ).toThrow(/DATABASE_URL/);
  });

  it('lehnt ungültigen PORT ab', () => {
    expect(() => loadConfig({ ...base, PORT: 'abc' })).toThrow(/PORT/);
  });

  it('verlangt SESSION_KEY mit 64 Hex-Zeichen', () => {
    expect(() => loadConfig({ DATABASE_URL: url })).toThrow(/SESSION_KEY/);
    expect(() =>
      loadConfig({ ...base, SESSION_KEY: '<sitzungsschluessel>' }),
    ).toThrow(/SESSION_KEY/);
    expect(() => loadConfig({ ...base, SESSION_KEY: 'ab'.repeat(16) })).toThrow(
      /SESSION_KEY/,
    );
  });

  it('setzt Secure nur in der lokalen Entwicklung nicht', () => {
    expect(loadConfig({ ...base, NODE_ENV: 'development' }).secureCookie).toBe(
      false,
    );
    expect(loadConfig({ ...base, NODE_ENV: 'production' }).secureCookie).toBe(
      true,
    );
  });
});
