import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { App } from './App';

function mockFetch(impl: () => Promise<unknown>) {
  vi.stubGlobal('fetch', vi.fn(impl));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('zeigt "Datenbank erreichbar", wenn /health datenbank:true liefert', async () => {
    mockFetch(async () => ({
      json: async () => ({ status: 'ok', datenbank: true }),
    }));
    render(<App />);
    expect(await screen.findByText('Datenbank erreichbar')).toBeTruthy();
  });

  it('zeigt "Datenbank nicht erreichbar", wenn datenbank:false', async () => {
    mockFetch(async () => ({
      json: async () => ({ status: 'fehler', datenbank: false }),
    }));
    render(<App />);
    expect(await screen.findByText('Datenbank nicht erreichbar')).toBeTruthy();
  });

  it('zeigt Fehler, wenn das Backend nicht antwortet', async () => {
    mockFetch(async () => {
      throw new Error('netzwerk');
    });
    render(<App />);
    expect(await screen.findByText('Backend nicht erreichbar')).toBeTruthy();
  });
});
