import { useEffect, useState } from 'react';

type State = 'laedt' | 'erreichbar' | 'nicht-erreichbar' | 'fehler';

const labels: Record<State, string> = {
  laedt: 'Prüfe Status …',
  erreichbar: 'Datenbank erreichbar',
  'nicht-erreichbar': 'Datenbank nicht erreichbar',
  fehler: 'Backend nicht erreichbar',
};

export function App() {
  const [state, setState] = useState<State>('laedt');

  useEffect(() => {
    let active = true;
    fetch('/health')
      .then((res) => res.json() as Promise<{ datenbank?: boolean }>)
      .then((body) => {
        if (active)
          setState(body.datenbank ? 'erreichbar' : 'nicht-erreichbar');
      })
      .catch(() => {
        if (active) setState('fehler');
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
