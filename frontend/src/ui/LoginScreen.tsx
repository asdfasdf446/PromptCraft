import { createSignal, Show } from 'solid-js';
import { getGuestToken, login, register } from '../network/auth';

type Mode = 'home' | 'login' | 'register';

interface Props {
  onAuth: (token: string) => void;
}

export default function LoginScreen(props: Props) {
  const [mode, setMode] = createSignal<Mode>('home');
  const [username, setUsername] = createSignal('');
  const [password, setPassword] = createSignal('');
  const [error, setError] = createSignal('');
  const [loading, setLoading] = createSignal(false);

  const reset = () => { setUsername(''); setPassword(''); setError(''); };

  const handleGuest = async () => {
    setLoading(true); setError('');
    try {
      props.onAuth(await getGuestToken());
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleLogin = async (e: Event) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      props.onAuth(await login(username(), password()));
    } catch (e: any) {
      setError('Invalid username or password');
      setLoading(false);
    }
  };

  const handleRegister = async (e: Event) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      await register(username(), password());
      props.onAuth(await login(username(), password()));
    } catch (e: any) {
      setError(e.message.includes('409') ? 'Username already taken' : e.message);
      setLoading(false);
    }
  };

  const s = {
    overlay: { position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.92)', display: 'flex', 'align-items': 'center', 'justify-content': 'center', 'z-index': '100' } as any,
    card: { background: '#1a1a2e', border: '1px solid #333', 'border-radius': '12px', padding: '40px', width: '340px', color: '#eee', 'font-family': 'monospace' } as any,
    title: { 'font-size': '26px', 'font-weight': 'bold', 'text-align': 'center', 'margin-bottom': '6px', color: '#e2b96f', 'letter-spacing': '3px' } as any,
    sub: { 'text-align': 'center', color: '#666', 'font-size': '12px', 'margin-bottom': '32px' } as any,
    input: { width: '100%', padding: '10px', 'border-radius': '6px', border: '1px solid #444', background: '#111', color: '#eee', 'font-family': 'monospace', 'font-size': '14px', 'margin-bottom': '12px', 'box-sizing': 'border-box' } as any,
    primary: { width: '100%', padding: '11px', 'border-radius': '6px', border: 'none', cursor: 'pointer', 'font-size': '14px', 'font-family': 'monospace', 'font-weight': 'bold', background: '#e2b96f', color: '#1a1a2e', 'margin-bottom': '10px' } as any,
    secondary: { width: '100%', padding: '11px', 'border-radius': '6px', border: '1px solid #444', cursor: 'pointer', 'font-size': '14px', 'font-family': 'monospace', background: '#2a2a4e', color: '#aaa', 'margin-bottom': '10px' } as any,
    ghost: { width: '100%', padding: '8px', border: 'none', cursor: 'pointer', 'font-size': '13px', 'font-family': 'monospace', background: 'transparent', color: '#555', 'margin-top': '4px' } as any,
    error: { color: '#ff6b6b', 'font-size': '13px', 'text-align': 'center', 'margin-bottom': '12px' } as any,
  };

  return (
    <div style={s.overlay}>
      <div style={s.card}>
        <div style={s.title}>PromptCraft</div>
        <div style={s.sub}>Text-controlled multiplayer combat</div>

        <Show when={mode() === 'home'}>
          <button style={s.primary} onClick={handleGuest} disabled={loading()}>
            {loading() ? 'Connecting...' : 'Play as Guest'}
          </button>
          <button style={s.secondary} onClick={() => { reset(); setMode('login'); }}>Login</button>
          <button style={s.secondary} onClick={() => { reset(); setMode('register'); }}>Register</button>
          <Show when={error()}><div style={s.error}>{error()}</div></Show>
        </Show>

        <Show when={mode() === 'login'}>
          <form onSubmit={handleLogin}>
            <input style={s.input} type="text" placeholder="Username" value={username()} onInput={e => setUsername(e.currentTarget.value)} required />
            <input style={s.input} type="password" placeholder="Password" value={password()} onInput={e => setPassword(e.currentTarget.value)} required />
            <Show when={error()}><div style={s.error}>{error()}</div></Show>
            <button style={s.primary} type="submit" disabled={loading()}>{loading() ? 'Logging in...' : 'Login'}</button>
            <button style={s.ghost} type="button" onClick={() => { reset(); setMode('home'); }}>Back</button>
          </form>
        </Show>

        <Show when={mode() === 'register'}>
          <form onSubmit={handleRegister}>
            <input style={s.input} type="text" placeholder="Username" value={username()} onInput={e => setUsername(e.currentTarget.value)} required />
            <input style={s.input} type="password" placeholder="Password" value={password()} onInput={e => setPassword(e.currentTarget.value)} required />
            <Show when={error()}><div style={s.error}>{error()}</div></Show>
            <button style={s.primary} type="submit" disabled={loading()}>{loading() ? 'Registering...' : 'Register'}</button>
            <button style={s.ghost} type="button" onClick={() => { reset(); setMode('home'); }}>Back</button>
          </form>
        </Show>
      </div>
    </div>
  );
}
