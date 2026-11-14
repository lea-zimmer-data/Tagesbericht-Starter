import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const url = 'postgres://user:pw@localhost:5432/db';

describe('loadConfig', () => {
  it('liefert Werte und Standardwerte bei gültiger Eingabe', () => {
    const config = loadConfig({ DATABASE_URL: url });
    expect(config).toEqual({ DATABASE_URL: url, PORT: 3000, HOST: '0.0.0.0' });
  });

  it('übernimmt PORT aus der Umgebung als Zahl', () => {
    expect(loadConfig({ DATABASE_URL: url, PORT: '4000' }).PORT).toBe(4000);
  });

  it('nennt fehlende Variable beim Namen', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });

  it('lehnt Platzhalter-URL ab', () => {
    expect(() =>
      loadConfig({ DATABASE_URL: 'postgres://<benutzer>:pw@db/<datenbank>' }),
    ).toThrow(/DATABASE_URL/);
  });

  it('lehnt ungültigen PORT ab', () => {
    expect(() => loadConfig({ DATABASE_URL: url, PORT: 'abc' })).toThrow(
      /PORT/,
    );
  });
});
