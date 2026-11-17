import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { App, labels, loadHealthState } from './App';

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
