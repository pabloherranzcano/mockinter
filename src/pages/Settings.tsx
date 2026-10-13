import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { ENGLISH_OPTIONS, ROLES } from '../lib/models';
import { Logo } from '../components/Logo';

export default function Settings() {
  const auth = useAuth();
  const navigate = useNavigate();
  const p = auth.profile;
  const [name, setName] = useState(p?.display_name ?? '');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const roleName = ROLES.find((r) => r.code === p?.target_role)?.name ?? '—';
  const englishLabel = ENGLISH_OPTIONS.find((e) => e.code === p?.english)?.label ?? '';
  const flash = () => { setMsg(''); setError(''); };

  async function saveName(e: FormEvent) {
    e.preventDefault(); flash();
    try { await auth.updateProfile({ display_name: name.trim() || null }); setMsg('Nombre guardado.'); }
    catch { setError('No se pudo guardar el nombre.'); }
  }
  async function savePassword(e: FormEvent) {
    e.preventDefault(); flash();
    try { await auth.updatePassword(password); setPassword(''); setMsg('Contraseña cambiada.'); }
    catch (err) { setError((err as Error)?.message ?? 'No se pudo cambiar la contraseña.'); }
  }
  async function logout() { await auth.signOut(); navigate('/entrar', { replace: true }); }
  async function deleteAccount() {
    flash();
    try { await auth.deleteAccount(); navigate('/entrar', { replace: true }); }
    catch { setError('No se pudo borrar la cuenta. Escríbenos y lo hacemos a mano.'); }
  }

  return (
    <main className="wrap">
      <header className="top"><Logo /><Link className="btn ghost sm" to="/">Volver</Link></header>
      <h2 style={{ fontSize: '1.8rem', marginTop: 24 }}>Ajustes</h2>

      <section className="card stack" style={{ marginTop: 18 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Tu preparación</p>
        <p style={{ margin: 0 }}>{p?.onboarded ? <><strong>{roleName}</strong> · {p.level} · {englishLabel}</> : 'Aún no has elegido puesto y nivel.'}</p>
        <Link className="btn ghost sm" to="/empezar" style={{ justifySelf: 'start' }}>Cambiar puesto, nivel o idioma</Link>
      </section>

      <section className="card stack" style={{ marginTop: 14 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Cuenta</p>
        <p style={{ margin: 0 }} className="muted">{auth.session?.user.email}</p>
        <form className="stack" onSubmit={saveName}>
          <label className="field">Nombre
            <input id="display-name" type="text" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn sm" type="submit" style={{ justifySelf: 'start' }}>Guardar nombre</button>
        </form>
        <form className="stack" onSubmit={savePassword}>
          <label className="field">Nueva contraseña
            <input id="new-password" type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <button className="btn ghost sm" type="submit" style={{ justifySelf: 'start' }} disabled={password.length < 8}>Cambiar contraseña</button>
        </form>
        {msg && <div className="notice">{msg}</div>}
        {error && <div className="error">{error}</div>}
        <button className="btn ghost" onClick={logout} style={{ justifySelf: 'start' }}>Cerrar sesión</button>
      </section>

      <section className="card stack" style={{ marginTop: 14 }}>
        <p className="eyebrow" style={{ margin: 0 }}>Zona de peligro</p>
        {!confirmDelete ? (
          <button className="btn bad sm" style={{ justifySelf: 'start' }} onClick={() => setConfirmDelete(true)}>Borrar mi cuenta</button>
        ) : (
          <>
            <p style={{ margin: 0 }}>Se borrarán tu cuenta, tu progreso y tu racha. No se puede deshacer.</p>
            <div className="row">
              <button className="btn ghost sm" onClick={() => setConfirmDelete(false)}>Cancelar</button>
              <button className="btn bad sm" onClick={deleteAccount}>Sí, borrar para siempre</button>
            </div>
          </>
        )}
      </section>
      <p className="small muted" style={{ marginTop: 20 }}><Link to="/privacidad">Política de privacidad</Link></p>
    </main>
  );
}
