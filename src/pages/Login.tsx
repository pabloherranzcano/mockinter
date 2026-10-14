import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { Logo } from '../components/Logo';

type Mode = 'in' | 'up' | 'reset';

function translate(msg?: string): string {
  if (!msg) return 'Algo ha fallado. Inténtalo de nuevo.';
  if (/invalid login/i.test(msg)) return 'Email o contraseña incorrectos.';
  if (/already registered/i.test(msg)) return 'Ya existe una cuenta con ese email. Prueba a entrar.';
  if (/email not confirmed/i.test(msg)) return 'Confirma tu email desde el enlace que te enviamos.';
  if (/rate limit/i.test(msg)) return 'Demasiados intentos. Espera unos minutos.';
  if (/provider is not enabled/i.test(msg)) return 'El acceso con Google no está activado todavía.';
  return msg;
}

export default function Login() {
  const auth = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setNotice(''); setBusy(true);
    try {
      if (mode === 'in') {
        const p = await auth.signIn(email, password);
        navigate(p?.onboarded ? '/' : '/empezar', { replace: true });
      } else if (mode === 'up') {
        if (password.length < 8) throw new Error('La contraseña necesita al menos 8 caracteres.');
        const { needsConfirmation } = await auth.signUp(email, password);
        if (needsConfirmation) setNotice('Te hemos enviado un email. Confirma tu cuenta desde el enlace y vuelve a entrar.');
        else navigate('/empezar', { replace: true });
      } else {
        await auth.resetPassword(email);
        setNotice('Si el email existe, te llegará un enlace para cambiar la contraseña.');
      }
    } catch (err) {
      setError(translate((err as Error)?.message));
    } finally { setBusy(false); }
  }

  async function google() {
    try { await auth.signInWithGoogle(); } catch (err) { setError(translate((err as Error)?.message)); }
  }

  return (
    <main className="wrap" style={{ maxWidth: 440 }}>
      <Logo />
      <h2 style={{ fontSize: '2rem', marginTop: 28 }}>Prepara tus entrevistas técnicas, 5 minutos al día</h2>
      <p className="muted">Lecciones cortas de Angular, React, Cloud/DevOps y Backend, con preguntas de código y práctica de inglés.</p>

      <div className="card stack" style={{ marginTop: 20 }}>
        <div className="row">
          <button type="button" className={'btn sm' + (mode !== 'in' ? ' ghost' : '')} onClick={() => setMode('in')}>Entrar</button>
          <button type="button" className={'btn sm' + (mode !== 'up' ? ' ghost' : '')} onClick={() => setMode('up')}>Crear cuenta</button>
        </div>

        <form className="stack" onSubmit={submit}>
          <label className="field">Email
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode !== 'reset' && (
            <label className="field">Contraseña
              <input id="password" type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'up' ? 'new-password' : 'current-password'} />
            </label>
          )}
          {mode === 'up' && (
            <p className="small muted" style={{ margin: 0 }}>Al crear la cuenta aceptas la <Link to="/privacidad">política de privacidad</Link>.</p>
          )}
          {error && <div className="error">{error}</div>}
          {notice && <div className="notice">{notice}</div>}
          <button className="btn full" type="submit" disabled={busy}>
            {mode === 'in' ? 'Entrar' : mode === 'up' ? 'Crear cuenta' : 'Enviar enlace'}
          </button>
        </form>

        {mode === 'in' && <button type="button" className="link small" onClick={() => setMode('reset')}>He olvidado mi contraseña</button>}
        {mode === 'reset' && <button type="button" className="link small" onClick={() => setMode('in')}>Volver</button>}

        <div className="row muted small" style={{ justifyContent: 'center' }}>o</div>
        <button type="button" className="btn ghost full" onClick={google}>Continuar con Google</button>
      </div>
      <p className="small muted" style={{ marginTop: 24 }}><Link to="/privacidad">Privacidad</Link></p>
    </main>
  );
}
