import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { fetchPathTopics, fetchWrongCount, type PathTopic } from '../lib/api';
import { ROLES } from '../lib/models';
import { todayMadrid, yesterdayMadrid } from '../lib/utils';
import { Logo } from '../components/Logo';

const GOAL = 50;

export default function Home() {
  const { profile: p, isAdmin } = useAuth();
  const topicsQ = useQuery({
    queryKey: ['path', p?.target_role, p?.level, p?.english],
    queryFn: () => fetchPathTopics(p!),
    enabled: !!p,
  });
  const wrongQ = useQuery({ queryKey: ['wrongCount'], queryFn: fetchWrongCount });

  const topics: PathTopic[] = topicsQ.data ?? [];
  const today = todayMadrid();
  const streak = p && (p.last_day === today || p.last_day === yesterdayMadrid()) ? p.streak : 0;
  const todayXp = p?.day_xp_date === today ? p.day_xp : 0;
  const ringOffset = (163.4 * (1 - Math.min(1, todayXp / GOAL))).toFixed(1);
  const nextTopic = topics.find((t) => !t.stars) ?? topics[0];
  const roleName = ROLES.find((r) => r.code === p?.target_role)?.name ?? '';
  const startLabel = topics.length && topics.every((t) => t.stars) ? 'Practicar' : topics.some((t) => t.stars) ? 'Seguir' : 'Empezar';

  let goalTitle = `Meta diaria: ${GOAL} XP`;
  if (todayXp >= GOAL) goalTitle = 'Meta de hoy cumplida';
  else if (streak > 0 && p?.last_day !== today) goalTitle = `Mantén tu racha de ${p!.streak} ${p!.streak === 1 ? 'día' : 'días'}`;
  const goalSub = todayXp >= GOAL ? `${todayXp} XP hoy. Mañana, otra.`
    : todayXp ? `Llevas ${todayXp} XP hoy. Te faltan ${GOAL - todayXp}.`
    : 'Una lección son unos 5 minutos. Haz una para empezar.';

  return (
    <main className="wrap">
      <header className="top">
        <Logo />
        <div className="stats">
          <div className="stat" title="Días seguidos practicando">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.4 1.2-3.8 2.3-4.8.2 1.6.9 2.6 1.9 3C10.6 7.4 11.3 4.6 12 2z" fill="var(--accent)" /><path d="M12 13c.6 1.6 2.4 2.2 2.4 4.2a2.4 2.4 0 0 1-4.8 0c0-1.5.9-2.6 2.4-4.2z" fill="var(--accent-deep)" /></svg>
            <span>{streak}</span>
          </div>
          <div className="stat" title="Experiencia total">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" fill="var(--navy)" /></svg>
            <span>{p?.xp ?? 0} XP</span>
          </div>
          {isAdmin && (
            <Link className="icon-btn" to="/admin" aria-label="Panel de admin" title="Panel de admin">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l8 4v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4z" /></svg>
            </Link>
          )}
          <Link className="icon-btn" to="/ajustes" aria-label="Ajustes" title="Ajustes">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>
          </Link>
        </div>
      </header>

      <section className="goal">
        <svg className="ring" viewBox="0 0 64 64" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="8" />
          <circle cx="32" cy="32" r="26" fill="none" stroke="var(--accent)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray="163.4" strokeDashoffset={ringOffset} transform="rotate(-90 32 32)" />
          <text x="32" y="37" textAnchor="middle" fontFamily="Figtree, sans-serif" fontWeight="700" fontSize="14" fill="currentColor">{todayXp}</text>
        </svg>
        <div>
          <h2>{goalTitle}</h2>
          <p>{goalSub}</p>
        </div>
        <div className="actions">
          {nextTopic && <Link className="btn" to={`/leccion/${nextTopic.id}`}>{startLabel}</Link>}
        </div>
      </section>

      <p className="eyebrow" style={{ marginTop: 24 }}>
        {roleName} · {p?.level} · {p?.english === 'no' ? 'entrevista en español' : 'entrevista en inglés'} · <Link to="/ajustes">cambiar</Link>
      </p>

      {topicsQ.isError && <div className="error" style={{ marginTop: 16 }}>No se pudo cargar tu camino. Recarga la página.</div>}
      {topicsQ.isLoading && <p className="muted" style={{ marginTop: 24 }}>Cargando tu camino…</p>}

      <div className="path">
        {topics.map((t, i) => {
          const isNext = t.id === nextTopic?.id && !t.stars;
          return (
            <div className="stop" key={t.id}>
              <Link className={'node' + (t.stars > 0 ? ' done' : '') + (isNext ? ' next' : '')} to={`/leccion/${t.id}`}
                aria-label={`Lección ${i + 1}: ${t.name}`}>
                {t.stars > 0
                  ? <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                  : i + 1}
              </Link>
              <div className="info">
                <div className="eyebrow">
                  Lección {i + 1} · {t.role === 'COM' ? 'Para cualquier puesto' : t.role_name}
                  {t.stars > 0 && (
                    <span className="stars" aria-label={`${t.stars} de 3 estrellas`}>
                      {[1, 2, 3].map((n) => <i key={n} className={n <= t.stars ? 'on' : ''} />)}
                    </span>
                  )}
                </div>
                <h3>{t.name}</h3>
                {isNext && <span className="tag">Siguiente</span>}
              </div>
            </div>
          );
        })}
      </div>

      {(wrongQ.data ?? 0) > 0 && (
        <Link className="btn ghost full" style={{ marginTop: 24 }} to="/repaso">Repasar mis fallos ({wrongQ.data})</Link>
      )}
    </main>
  );
}
