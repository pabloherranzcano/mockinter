import { Link } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { fetchPathTopics, fetchWrongCount, type PathTopic } from '../lib/api';
import { BLOCK_LABELS, ROLES, type Level } from '../lib/models';
import { LEVEL_SHORT, nextStep, topicComplete, topicSteps, type StepState } from '../lib/progress';
import { todayMadrid, yesterdayMadrid } from '../lib/utils';
import { Logo } from '../components/Logo';

const GOAL = 50;

interface TopicView { topic: PathTopic; steps: StepState[]; next: StepState; complete: boolean; }

export default function Home() {
  const { profile: p, isAdmin } = useAuth();
  const start: Level = p?.level ?? 'Junior';
  const topicsQ = useQuery({
    queryKey: ['path', p?.target_role, p?.english],
    queryFn: () => fetchPathTopics(p!),
    enabled: !!p,
  });
  const wrongQ = useQuery({ queryKey: ['wrongCount'], queryFn: fetchWrongCount });

  const views: TopicView[] = (topicsQ.data ?? []).map((topic) => {
    const steps = topicSteps(topic.stars, start);
    return { topic, steps, next: nextStep(steps, start), complete: topicComplete(steps, start) };
  });
  const current = views.find((v) => !v.complete) ?? views[0];

  const today = todayMadrid();
  const streak = p && (p.last_day === today || p.last_day === yesterdayMadrid()) ? p.streak : 0;
  const todayXp = p?.day_xp_date === today ? p.day_xp : 0;
  const ringOffset = (163.4 * (1 - Math.min(1, todayXp / GOAL))).toFixed(1);
  const roleName = ROLES.find((r) => r.code === p?.target_role)?.name ?? '';
  const anyDone = views.some((v) => v.steps.some((s) => s.done));
  const allDone = views.length > 0 && views.every((v) => v.complete);

  let goalTitle = `Meta diaria: ${GOAL} XP`;
  if (todayXp >= GOAL) goalTitle = 'Meta de hoy cumplida';
  else if (streak > 0 && p?.last_day !== today) goalTitle = `Mantén tu racha de ${p!.streak} ${p!.streak === 1 ? 'día' : 'días'}`;
  const goalSub = todayXp >= GOAL ? `${todayXp} XP hoy. Mañana, otra.`
    : current ? `Siguiente: ${current.topic.name} · ${current.next.level}`
    : 'Una lección son unos 5 minutos.';

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
          {current && (
            <Link className="btn" to={`/leccion/${current.topic.id}/${current.next.level}`}>
              {allDone ? 'Practicar' : anyDone ? 'Seguir' : 'Empezar'}
            </Link>
          )}
        </div>
      </section>

      <p className="eyebrow" style={{ marginTop: 24 }}>
        {roleName} · empiezas en {start} · {p?.english === 'no' ? 'entrevista en español' : 'entrevista en inglés'} · <Link to="/ajustes">cambiar</Link>
      </p>

      {topicsQ.isError && <div className="error" style={{ marginTop: 16 }}>No se pudo cargar tu camino. Recarga la página.</div>}
      {topicsQ.isLoading && <p className="muted" style={{ marginTop: 24 }}>Cargando tu camino…</p>}

      <div className="path">
        {views.map((v, i) => {
          const { topic: t, steps, next, complete } = v;
          const isCurrent = t.id === current?.topic.id && !complete;
          const showBlock = i === 0 || views[i - 1].topic.role !== t.role;
          return (
            <div key={t.id}>
              {showBlock && <div className="block-head">{BLOCK_LABELS[t.role] ?? t.role_name}</div>}
              <div className="stop">
                <Link className={'node' + (complete ? ' done' : '') + (isCurrent ? ' next' : '')}
                  to={`/leccion/${t.id}/${next.level}`} aria-label={`${t.name}, escalón ${next.level}`}>
                  {complete
                    ? <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                    : i + 1}
                </Link>
                <div className="info">
                  <h3>{t.name}</h3>
                  <div className="steps-row" role="list" aria-label="Escalones del tema">
                    {steps.map((s) => {
                      const cls = 'step' + (s.done ? ' done' : '') + (!s.unlocked ? ' locked' : '') + (isCurrent && s.level === next.level ? ' next' : '');
                      const pips = (
                        <span className="pips" aria-hidden="true">
                          {[1, 2, 3].map((n) => <i key={n} className={n <= s.stars ? 'on' : ''} />)}
                        </span>
                      );
                      const label = `${s.level}${s.done ? `, ${s.stars} de 3 estrellas` : ''}${!s.unlocked ? ', bloqueado' : ''}`;
                      return s.unlocked ? (
                        <Link key={s.level} role="listitem" className={cls} to={`/leccion/${t.id}/${s.level}`} aria-label={label} title={label}>
                          {LEVEL_SHORT[s.level]} {pips}
                        </Link>
                      ) : (
                        <span key={s.level} role="listitem" className={cls} aria-label={label} title={`Completa ${steps[steps.indexOf(s) - 1]?.level} para desbloquear`}>
                          {LEVEL_SHORT[s.level]} {pips}
                        </span>
                      );
                    })}
                  </div>
                </div>
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
