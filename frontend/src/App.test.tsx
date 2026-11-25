import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import {
  Angemeldet,
  App,
  LoginForm,
  labels,
  loadHealthState,
  loadSession,
  login,
  logout,
} from './App';

function fakeFetch(impl: () => Promise<unknown>) {
  return vi.fn(impl) as unknown as typeof fetch;
}

describe('Health-Anzeige', () => {
  it('zeigt "Datenbank erreichbar", wenn /health datenbank:true liefert', async () => {
    const state = await loadHealthState(
      fakeFetch(async () => ({
        json: async () => ({ status: 'ok', datenbank: true }),
      })),
    );
    expect(labels[state]).toBe('Datenbank erreichbar');
  });

  it('zeigt "Datenbank nicht erreichbar", wenn datenbank:false', async () => {
    const state = await loadHealthState(
      fakeFetch(async () => ({
        json: async () => ({ status: 'fehler', datenbank: false }),
      })),
    );
    expect(labels[state]).toBe('Datenbank nicht erreichbar');
  });

  it('zeigt Fehler, wenn das Backend nicht antwortet', async () => {
    const state = await loadHealthState(
      fakeFetch(async () => {
        throw new Error('netzwerk');
      }),
    );
    expect(labels[state]).toBe('Backend nicht erreichbar');
  });

  it('zeigt beim Laden zuerst "Prüfe Status …"', () => {
    expect(renderToString(<App />)).toContain('Prüfe Status …');
  });
});

function antwort(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

const profil = {
  name: 'Henrike Sommerfeld',
  email: 'henrike.sommerfeld@morgenrot.example',
  rolle: 'bauleitung' as const,
  organisation: { name: 'Hochbau Morgenrot GmbH' },
};

describe('Sitzung', () => {
  it('liefert das Profil, wenn /api/sitzung 200 meldet', async () => {
    const fetchFn = fakeFetch(async () => antwort(200, profil));
    expect(await loadSession(fetchFn)).toEqual(profil);
    expect(fetchFn).toHaveBeenCalledWith('/api/sitzung');
  });

  it('liefert null ohne Sitzung (401) oder ohne Backend', async () => {
    expect(
      await loadSession(fakeFetch(async () => antwort(401, { fehler: 'x' }))),
    ).toBeNull();
    expect(
      await loadSession(
        fakeFetch(async () => {
          throw new Error('netzwerk');
        }),
      ),
    ).toBeNull();
  });
});

describe('Anmeldung', () => {
  it('sendet E-Mail und Passwort als JSON und liefert das Profil', async () => {
    const fetchFn = fakeFetch(async () => antwort(200, profil));
    expect(await login('a@b.example', 'geheim', fetchFn)).toEqual({
      ok: true,
      profil,
    });
    const [url, init] = vi.mocked(fetchFn).mock.calls[0]!;
    expect(url).toBe('/api/anmeldung');
    expect(init).toMatchObject({ method: 'POST' });
    expect(JSON.parse(init!.body as string)).toEqual({
      email: 'a@b.example',
      passwort: 'geheim',
    });
  });

  it('meldet den Fehlertext bei 401', async () => {
    const fetchFn = fakeFetch(async () =>
      antwort(401, { fehler: 'E-Mail oder Passwort falsch' }),
    );
    expect(await login('a@b.example', 'falsch', fetchFn)).toEqual({
      ok: false,
      fehler: 'E-Mail oder Passwort falsch',
    });
  });

  it('meldet sich über POST /api/abmeldung ab', async () => {
    const fetchFn = fakeFetch(async () => antwort(204));
    await logout(fetchFn);
    expect(fetchFn).toHaveBeenCalledWith('/api/abmeldung', { method: 'POST' });
  });
});

describe('Oberfläche', () => {
  it('prüft beim Laden zuerst die Anmeldung', () => {
    expect(renderToString(<App />)).toContain('Prüfe Anmeldung …');
  });

  it('zeigt das Anmeldeformular', () => {
    const html = renderToString(<LoginForm onLogin={() => {}} />);
    expect(html).toContain('type="email"');
    expect(html).toContain('type="password"');
    expect(html).toContain('Anmelden');
  });

  it('zeigt nach der Anmeldung Name, Rolle, Organisation und Abmelden', () => {
    const html = renderToString(
      <Angemeldet profil={profil} onLogout={() => {}} />,
    );
    expect(html).toContain('Henrike Sommerfeld');
    expect(html).toContain('Bauleitung');
    expect(html).toContain('Hochbau Morgenrot GmbH');
    expect(html).toContain('Abmelden');
  });
});
