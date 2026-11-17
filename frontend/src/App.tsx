import { useEffect, useState } from 'react';

export type State = 'laedt' | 'erreichbar' | 'nicht-erreichbar' | 'fehler';

export const labels: Record<State, string> = {
  laedt: 'Prüfe Status …',
  erreichbar: 'Datenbank erreichbar',
  'nicht-erreichbar': 'Datenbank nicht erreichbar',
  fehler: 'Backend nicht erreichbar',
};

export async function loadHealthState(
  fetchFn: typeof fetch = fetch,
): Promise<State> {
  try {
    const res = await fetchFn('/health');
    const body = (await res.json()) as { datenbank?: boolean };
    return body.datenbank ? 'erreichbar' : 'nicht-erreichbar';
  } catch {
    return 'fehler';
  }
}

export function App() {
  const [state, setState] = useState<State>('laedt');

  useEffect(() => {
    let active = true;
    loadHealthState().then((next) => {
      if (active) setState(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main>
      <h1>Tagesbericht-Starter</h1>
      <p role="status">{labels[state]}</p>
    </main>
  );
}
