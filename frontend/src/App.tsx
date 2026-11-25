import { useEffect, useState, type FormEvent } from 'react';

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

export type Rolle = 'bauleitung' | 'mitarbeiter';

export const rolleLabels: Record<Rolle, string> = {
  bauleitung: 'Bauleitung',
  mitarbeiter: 'Mitarbeiter',
};

export interface Profil {
  name: string;
  email: string;
  rolle: Rolle;
  organisation: { name: string };
}

/** Aktuelle Sitzung oder null, wenn nicht angemeldet. */
export async function loadSession(
  fetchFn: typeof fetch = fetch,
): Promise<Profil | null> {
  try {
    const res = await fetchFn('/api/sitzung');
    return res.ok ? ((await res.json()) as Profil) : null;
  } catch {
    return null;
  }
}

export type LoginResult =
  { ok: true; profil: Profil } | { ok: false; fehler: string };

export async function login(
  email: string,
  passwort: string,
  fetchFn: typeof fetch = fetch,
): Promise<LoginResult> {
  try {
    const res = await fetchFn('/api/anmeldung', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, passwort }),
    });
    if (res.ok) return { ok: true, profil: (await res.json()) as Profil };
    const body = (await res.json().catch(() => ({}))) as { fehler?: string };
    return { ok: false, fehler: body.fehler ?? 'Anmeldung fehlgeschlagen' };
  } catch {
    return { ok: false, fehler: 'Backend nicht erreichbar' };
  }
}

export async function logout(fetchFn: typeof fetch = fetch): Promise<void> {
  await fetchFn('/api/abmeldung', { method: 'POST' });
}

// NF-4: Bedienelemente mindestens 48 px hoch.
const control = { minHeight: 48, fontSize: '1rem' };

export function Angemeldet({
  profil,
  onLogout,
}: {
  profil: Profil;
  onLogout: () => void;
}) {
  return (
    <section>
      <p>
        Angemeldet als <strong>{profil.name}</strong>
      </p>
      <dl>
        <dt>Rolle</dt>
        <dd>{rolleLabels[profil.rolle]}</dd>
        <dt>Organisation</dt>
        <dd>{profil.organisation.name}</dd>
      </dl>
      <button type="button" style={control} onClick={onLogout}>
        Abmelden
      </button>
    </section>
  );
}

export function LoginForm({ onLogin }: { onLogin: (profil: Profil) => void }) {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [fehler, setFehler] = useState<string | null>(null);
  const [sendet, setSendet] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSendet(true);
    const result = await login(email, passwort);
    setSendet(false);
    if (result.ok) {
      setPasswort('');
      onLogin(result.profil);
    } else {
      setFehler(result.fehler);
    }
  }

  return (
    <form onSubmit={submit}>
      <h2>Anmelden</h2>
      <p>
        <label>
          E-Mail
          <br />
          <input
            type="email"
            autoComplete="username"
            required
            style={control}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
      </p>
      <p>
        <label>
          Passwort
          <br />
          <input
            type="password"
            autoComplete="current-password"
            required
            style={control}
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
          />
        </label>
      </p>
      {fehler && <p role="alert">{fehler}</p>}
      <button type="submit" style={control} disabled={sendet}>
        Anmelden
      </button>
    </form>
  );
}

export function App() {
  const [state, setState] = useState<State>('laedt');
  // undefined = Sitzung wird geprüft, null = nicht angemeldet.
  const [profil, setProfil] = useState<Profil | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    loadHealthState().then((next) => {
      if (active) setState(next);
    });
    loadSession().then((next) => {
      if (active) setProfil(next);
    });
    return () => {
      active = false;
    };
  }, []);

  async function abmelden() {
    await logout().catch(() => {});
    setProfil(null);
  }

  return (
    <main>
      <h1>Tagesbericht-Starter</h1>
      <p role="status">{labels[state]}</p>
      {profil === undefined ? (
        <p>Prüfe Anmeldung …</p>
      ) : profil ? (
        <Angemeldet profil={profil} onLogout={abmelden} />
      ) : (
        <LoginForm onLogin={setProfil} />
      )}
    </main>
  );
}
