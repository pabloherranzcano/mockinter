import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { clearWrong, fetchLessonQuestions, fetchReviewQuestions, fetchTopic, finishLesson, markWrong } from '../lib/api';
import type { Level, Question } from '../lib/models';
import { looksLikeCode } from '../lib/utils';
import { localizeQuestion } from '../lib/localize';
import { LEVEL_ORDER } from '../lib/progress';
import { Rich } from '../components/Rich';
import { CodeBlock } from '../components/CodeBlock';
import { ReportDialog } from '../components/ReportDialog';
import { HEARTS, accuracy, canCheck, initLesson, lessonReducer, starsFor, type LessonState } from './lessonReducer';

const RAYS = Array.from({ length: 12 }, (_, i) => i);

export default function Lesson({ review = false }: { review?: boolean }) {
  const { topicId = '', level: levelParam } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const lang: 'en' | 'es' = profile?.english === 'no' ? 'es' : 'en';
  const level: Level | null = LEVEL_ORDER.includes(levelParam as Level) ? (levelParam as Level) : profile?.level ?? null;

  useEffect(() => { if (!profile?.level) navigate('/empezar', { replace: true }); }, [profile, navigate]);

  const topicQ = useQuery({ queryKey: ['topic', topicId], queryFn: () => fetchTopic(topicId), enabled: !review && !!topicId });
  const questionsQ = useQuery({
    queryKey: review ? ['review', lang] : ['lesson', topicId, level],
    queryFn: () => (review ? fetchReviewQuestions(lang) : fetchLessonQuestions(topicId, level!)),
    enabled: review || !!level,
    staleTime: 0,
    gcTime: 0,
  });

  if (questionsQ.isLoading || !questionsQ.data) {
    if (questionsQ.isError) return <EmptyState review={review} error />;
    return <main className="wrap"><p className="muted">Preparando la lección…</p></main>;
  }
  const playable = questionsQ.data.map((q) => localizeQuestion(q, lang));
  if (!playable.length) return <EmptyState review={review} />;

  return <LessonRunner key={questionsQ.dataUpdatedAt} questions={playable} review={review}
    topicId={review ? null : topicId} level={review ? null : level}
    topicName={topicQ.data?.name ?? null} onRetry={() => questionsQ.refetch()} />;
}

function EmptyState({ review, error }: { review: boolean; error?: boolean }) {
  return (
    <main className="result">
      <h2>{error ? 'No se pudo cargar la lección' : review ? 'No tienes fallos que repasar' : 'Este escalón aún no tiene preguntas'}</h2>
      <p className="muted">{error ? 'Revisa tu conexión y vuelve a intentarlo.' : review ? 'Cuando falles alguna pregunta, aparecerá aquí.' : 'Estamos preparando el contenido de este tema para este nivel.'}</p>
      <Link className="btn" to="/">Volver al inicio</Link>
    </main>
  );
}

interface RunnerProps {
  questions: Question[]; review: boolean; topicId: string | null; level: Level | null;
  topicName: string | null; onRetry: () => void;
}

function LessonRunner({ questions, review, topicId, level, topicName, onRetry }: RunnerProps) {
  const { profile, session, setProfile } = useAuth();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(lessonReducer, questions, initLesson);
  const [reporting, setReporting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [bonus, setBonus] = useState(false);
  const finished = useRef(false);
  const q = state.queue[0];

  // Efectos secundarios de cada corrección: lista de fallos en el servidor
  useEffect(() => {
    const f = state.feedback;
    if (!f || !q || !session) return;
    if (f.kind === 'bad') void markWrong(session.user.id, q.id);
    if (f.kind === 'ok' && (review || f.firstTry)) void clearWrong(q.id);
  }, [state.feedback]);

  // Guardar el resultado al terminar
  useEffect(() => {
    if (state.phase !== 'result' || finished.current) return;
    finished.current = true;
    const perfect = !review && state.hearts === HEARTS;
    setBonus(perfect);
    const xp = state.xp + (perfect ? 10 : 0);
    finishLesson(topicId, level, starsFor(state), xp)
      .then((p) => {
        setProfile(p);
        void queryClient.invalidateQueries({ queryKey: ['path'] });
        void queryClient.invalidateQueries({ queryKey: ['wrongCount'] });
      })
      .catch(() => setSaveError('No se pudo guardar el progreso. Revisa tu conexión.'));
  }, [state.phase]);

  useEffect(() => { window.scrollTo(0, 0); }, [q?.id, state.done]);

  const onKey = useCallback((e: KeyboardEvent) => {
    if (state.phase !== 'play' || reporting) return;
    if (e.key === 'Enter') {
      if (state.feedback) { e.preventDefault(); dispatch({ type: 'next' }); }
      else if (q && canCheck(state)) { e.preventDefault(); dispatch({ type: 'check' }); }
      return;
    }
    const n = Number(e.key);
    if (q && !state.feedback && (q.type === 'mc' || q.type === 'fill') && n >= 1 && n <= state.options.length) dispatch({ type: 'select', index: n - 1 });
  }, [state, q, reporting]);
  useEffect(() => {
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onKey]);

  if (state.phase === 'dead') {
    return (
      <main className="result">
        <h2>Te quedaste sin vidas</h2>
        <p className="muted">Las preguntas que fallaste quedan en tu repaso. La segunda vez entra mejor.</p>
        <div className="stack" style={{ marginTop: 28 }}>
          <button className="btn" onClick={onRetry}>Reintentar</button>
          <Link className="btn ghost" to="/">Volver al inicio</Link>
        </div>
      </main>
    );
  }

  if (state.phase === 'result') {
    return (
      <main className="result">
        <svg viewBox="0 0 120 120" width="120" height="120" aria-hidden="true" style={{ margin: '0 auto 12px', display: 'block' }}>
          {RAYS.map((i) => <rect key={i} x="57" y="4" width="6" height="18" rx="3" fill="var(--accent)" opacity={i % 2 ? 0.45 : 0.9} transform={`rotate(${i * 30} 60 60)`} />)}
          <circle cx="60" cy="60" r="30" fill="var(--navy)" />
          <path d="M47 61l9 9 18-20" fill="none" stroke="var(--navy-ink)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <h2>{review ? '¡Repaso hecho!' : `¡Escalón ${level} completado!`}</h2>
        <p className="muted">{topicName ?? 'Lo que acertaste sale de tu lista de fallos.'}{bonus ? ' · sin fallos, +10 XP extra' : ''}</p>
        <div className="tiles">
          <div className="tile amber"><div className="lab">XP</div><div className="val">+{state.xp + (bonus ? 10 : 0)}</div></div>
          <div className="tile green"><div className="lab">Acierto</div><div className="val">{accuracy(state)}%</div></div>
          <div className="tile"><div className="lab">Racha</div><div className="val">{profile?.streak ?? 0}</div></div>
        </div>
        {saveError && <div className="error" style={{ marginBottom: 16 }}>{saveError}</div>}
        <Link className="btn full" to="/">Continuar</Link>
      </main>
    );
  }

  if (!q) return null;
  const f = state.feedback;

  return (
    <>
      <main className="lesson">
        <div className="lbar">
          <Link className="x" to="/" aria-label="Salir de la lección">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M6 6l12 12M18 6 6 18" /></svg>
          </Link>
          <div className="prog" role="progressbar" aria-valuenow={state.done} aria-valuemax={state.total}>
            <span style={{ width: `${(100 * state.done) / state.total}%` }} />
          </div>
          <div className="hearts" title="Vidas">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.3 3 4.5 6.7 4.5c2.1 0 3.6 1.1 5.3 3 1.7-1.9 3.2-3 5.3-3 3.7 0 5.8 3.8 4.3 7.2C19.5 16.4 12 21 12 21z" fill="currentColor" /></svg>
            {state.hearts}
          </div>
        </div>
        {!review && topicName && <p className="eyebrow" style={{ margin: '6px 0 0' }}>{topicName} · {level}</p>}

        {q.type === 'mc' && <MultipleChoice q={q} state={state} dispatch={dispatch} />}
        {q.type === 'fill' && <FillBlank q={q} state={state} dispatch={dispatch} />}
        {q.type === 'order' && <OrderPieces q={q} state={state} dispatch={dispatch} />}
      </main>

      <div className={'footer' + (f?.kind === 'ok' ? ' ok' : f?.kind === 'bad' ? ' bad' : '')}>
        <div className="in">
          {f ? (
            <>
              <div className="fb">
                <h3>{f.title}</h3>
                {f.solution && (looksLikeCode(f.solution) || f.solution.includes('\n')
                  ? <pre className="sol-code">{f.solution}</pre>
                  : <p className="sol">{f.solution}</p>)}
                {f.why && <p><Rich text={f.why} /></p>}
                {f.say && (
                  <div className="say">
                    <div className="say-lab">{f.say.label}</div>
                    <div className="say-en">“{f.say.en}”</div>
                    {f.say.es && <div className="say-es">{f.say.es}</div>}
                  </div>
                )}
                <button type="button" className="report-link" onClick={() => setReporting(true)}>Reportar un problema con esta pregunta</button>
              </div>
              <button id="continue-btn" className={'btn' + (f.kind === 'ok' ? ' ok' : ' bad')} onClick={() => dispatch({ type: 'next' })} autoFocus>Continuar</button>
            </>
          ) : (
            <>
              <div className="fb" />
              <button className="btn" disabled={!canCheck(state)} onClick={() => dispatch({ type: 'check' })}>Comprobar</button>
            </>
          )}
        </div>
      </div>

      {reporting && <ReportDialog questionId={q.id} onClose={() => setReporting(false)} />}
    </>
  );
}

type Dispatch = React.Dispatch<Parameters<typeof lessonReducer>[1]>;
interface ExProps { q: Question; state: LessonState; dispatch: Dispatch; }

function MultipleChoice({ q, state, dispatch }: ExProps) {
  const f = state.feedback;
  return (
    <>
      <div className="kind">{q.code ? 'Lee el código y elige' : 'Elige la respuesta'}</div>
      <div className="q"><Rich text={q.prompt} /></div>
      {q.code && <CodeBlock code={q.code} />}
      <div className="opts">
        {state.options.map((o, i) => {
          const isCode = looksLikeCode(o.text) || o.text.includes('\n');
          const cls = ['opt', isCode && 'code', !f && state.selected === i && 'sel', f && o.correct && 'right', f && state.selected === i && !o.correct && 'wrong'];
          return (
            <button key={o.text} className={cls.filter(Boolean).join(' ')} disabled={!!f} onClick={() => dispatch({ type: 'select', index: i })}>
              <span className="k">{i + 1}</span><span className="t"><Rich text={o.text} /></span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function FillBlank({ q, state, dispatch }: ExProps) {
  const f = state.feedback;
  const [before, ...rest] = q.prompt.split('___');
  return (
    <>
      <div className="kind">Completa la frase</div>
      {q.code && <CodeBlock code={q.code} />}
      <div className="sentence">
        <Rich text={before} /><span className="blank">{state.selected !== null ? state.options[state.selected].text : ' '}</span><Rich text={rest.join('___')} />
      </div>
      <div className="chips">
        {state.options.map((o, i) => {
          const cls = ['chip', looksLikeCode(o.text) && 'mono', !f && state.selected === i && 'sel', f && o.correct && 'right', f && state.selected === i && !o.correct && 'wrong'];
          return <button key={o.text} className={cls.filter(Boolean).join(' ')} disabled={!!f} onClick={() => dispatch({ type: 'select', index: i })}>{o.text}</button>;
        })}
      </div>
    </>
  );
}

function OrderPieces({ q, state, dispatch }: ExProps) {
  const f = state.feedback;
  return (
    <>
      <div className="kind">Ordena las piezas</div>
      <div className="q">{q.prompt}</div>
      {q.code && <CodeBlock code={q.code} />}
      <div className="answer-row">
        {state.placed.length === 0 && <span className="muted small" style={{ padding: 8 }}>Toca las piezas en orden</span>}
        {state.placed.map((idx, n) => (
          <button key={idx} className="chip" disabled={!!f} onClick={() => dispatch({ type: 'unplace', position: n })}>
            <em>{n + 1}</em><span>{state.orderItems[idx]}</span>
          </button>
        ))}
      </div>
      <div className="bank">
        {state.bank.map((idx) => (
          <button key={idx} className={'chip' + (state.placed.includes(idx) ? ' used' : '')} disabled={!!f} onClick={() => dispatch({ type: 'place', index: idx })}>
            {state.orderItems[idx]}
          </button>
        ))}
      </div>
    </>
  );
}
