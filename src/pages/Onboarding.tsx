import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../auth/AuthProvider';
import { ENGLISH_OPTIONS, LEVELS, ROLES, type English, type Level } from '../lib/models';
import { Logo } from '../components/Logo';

interface Choice { code: string; title: string; desc: string; }

/** Tres preguntas: puesto, nivel e idioma de la entrevista. También sirve para cambiarlas desde Ajustes. */
export default function Onboarding() {
  const { profile, updateProfile } = useAuth();
  const navigate = useNavigate();
  const editing = !!profile?.onboarded;
  const [step, setStep] = useState(0);
  const [role, setRole] = useState<string | null>(profile?.onboarded ? profile.target_role : null);
  const [level, setLevel] = useState<Level | null>(profile?.onboarded ? profile.level : null);
  const [english, setEnglish] = useState<English | null>(profile?.onboarded ? profile.english : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const steps: { title: string; options: Choice[]; value: string | null; set: (v: string) => void }[] = [
    { title: '¿Qué puesto buscas?', options: ROLES.map((r) => ({ code: r.code, title: r.name, desc: r.desc })), value: role, set: setRole },
    { title: '¿Qué nivel tiene el puesto?', options: LEVELS.map((l) => ({ code: l.code, title: l.code, desc: l.desc })), value: level, set: (v) => setLevel(v as Level) },
    { title: '¿La entrevista será en inglés?', options: ENGLISH_OPTIONS.map((e) => ({ code: e.code, title: e.label, desc: e.desc })), value: english, set: (v) => setEnglish(v as English) },
  ];
  const current = steps[step];

  async function next() {
    if (step < 2) { setStep(step + 1); return; }
    setBusy(true); setError('');
    try {
      await updateProfile({ target_role: role, level, english, onboarded: true });
      navigate('/', { replace: true });
    } catch {
      setError('No se pudo guardar. Revisa tu conexión e inténtalo otra vez.');
    } finally { setBusy(false); }
  }

  return (
    <main className="wrap" style={{ maxWidth: 520 }}>
      <Logo />
      <div className="steps" style={{ marginTop: 24 }} aria-hidden="true">
        {[0, 1, 2].map((s) => <i key={s} className={s <= step ? 'on' : ''} />)}
      </div>
      <p className="eyebrow" style={{ marginTop: 20 }}>Paso {step + 1} de 3</p>
      <h2 style={{ fontSize: '1.7rem' }}>{current.title}</h2>
      <div className="choices" style={{ marginTop: 18 }}>
        {current.options.map((o) => (
          <button key={o.code} type="button" className={'choice' + (current.value === o.code ? ' sel' : '')}
            aria-pressed={current.value === o.code} onClick={() => current.set(o.code)}>
            <strong>{o.title}</strong><span>{o.desc}</span>
          </button>
        ))}
      </div>
      {error && <div className="error" style={{ marginTop: 16 }}>{error}</div>}
      <div className="row" style={{ marginTop: 24 }}>
        {step > 0 && <button type="button" className="btn ghost" onClick={() => setStep(step - 1)}>Atrás</button>}
        <span className="spacer" />
        <button type="button" className="btn" disabled={current.value == null || busy} onClick={next}>
          {step < 2 ? 'Siguiente' : editing ? 'Guardar' : 'Empezar'}
        </button>
      </div>
    </main>
  );
}
