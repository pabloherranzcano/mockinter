import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../auth/AuthProvider';
import { clearWrong, fetchLessonQuestions, fetchReviewQuestions, fetchTopic, finishLesson, gradeAnswer, markWrong } from '../lib/api';
import type { Grade, Question } from '../lib/models';
import { looksLikeCode } from '../lib/utils';
import { localizeQuestion } from '../lib/localize';
import { Rich } from '../components/Rich';
import { ReportDialog } from '../components/ReportDialog';
import { HEARTS, PASS_SCORE, accuracy, canCheck, initLesson, lessonReducer, starsFor, type LessonState } from './lessonReducer';

const RAYS = Array.from({ length: 12 }, (_, i) => i);

export default function Lesson({ review = false }: { review?: boolean }) {
  const { topicId = '' } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const lang: 'en' | 'es' = profile?.english === 'no' ? 'es' : 'en';

  useEffect(() => { if (!profile?.level) navigate('/empezar', { replace: true }); }, [profile, navigate]);

  const topicQ = useQuery({ queryKey: ['topic', topicId], queryFn: () => fetchTopic(topicId), enabled: !review && !!topicId });
  const questionsQ = useQuery({
    queryKey: review ? ['review', lang] : ['lesson', topicId, profile?.level],
    queryFn: () => (review ? fetchReviewQuestions(lang) : fetchLessonQuestions(topicId, profile!.level!)),
    enabled: !!profile?.level,
    staleTime: 0,
    gcTime: 0,
  });

  if (questionsQ.isLoading || !questionsQ.data) {
    if (questionsQ.isError) return <EmptyState review={review} error />;
    return <main className="wrap"><p className="muted">Preparando la lección…</p></main>;
  }
  const playable = questionsQ.data
    .filter((q) => !(q.type === 'open' && !q.keys && !q.model_en && !q.model_es))
    .map((q) => localizeQuestion(q, lang));
  if (!playable.length) return <EmptyState review={review} />;

  return <LessonRunner key={questionsQ.dataUpdatedAt} questions={playable} review={review}
    topicId={review ? null : topicId} topicName={topicQ.data?.name ?? null} onRetry={() => questionsQ.refetch()} />;
}

function EmptyState({ review, error }: { review: boolean; error?: boolean }) {
  return (
    <main className="result">
      <h2>{error ? 'No se pudo cargar la lección' : review ? 'No tienes fallos que repasar' : 'Esta lección aún no tiene preguntas'}</h2>
      <p className="muted">{error ? 'Revisa tu conexión y vuelve a intentarlo.' : review ? 'Cuando falles alguna pregunta, aparecerá aquí.' : 'Estamos preparando el contenido de este tema para tu nivel.'}</p>
      <Link className="btn" to="/">Volver al inicio</Link>
    </main>
  );
}

interface RunnerProps { questions: Question[]; review: boolean; topicId: string | null; topicName: string | null; onRetry: () => void; }

function LessonRunner({ questions, review, topicId, topicName, onRetry }: RunnerProps) {
  const { profile, session, setProfile } = useAuth();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(lessonReducer, questions, initLesson);
  const [reporting, setReporting] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [bonus, setBonus] = useState(false);
  const finished = useRef(false);
  const q = state.queue[0];
  const lang: 'en' | 'es' = profile?.english === 'no' ? 'es' : 'en';

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
    finishLesson(topicId, review ? null : profile?.level ?? null, starsFor(state), xp)
      .then((p) => { setProfile(p); void queryClient.invalidateQueries({ queryKey: ['path'] }); void queryClient.invalidateQueries({ queryKey: ['wrongCount'] }); })
      .catch(() => setSaveError('No se pudo guardar el progreso. Revisa tu conexión.'));
  }, [state.phase]);

  useEffect(() => { window.scrollTo(0, 0); }, [q?.id, state.done]);

  const onKey = useCallback((e: KeyboardEvent) => {
    if (state.phase !== 'play' || reporting || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
    if (e.key === 'Enter') {
      if (state.feedback) { e.preventDefault(); dispatch({ type: 'next' }); }
      else if (q && q.type !== 'open' && canCheck(state)) { e.preventDefault(); dispatch({ type: 'check' }); }
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
        <h2>{review ? '¡Repaso hecho!' : '¡Lección completada!'}</h2>
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

        {q.type === 'mc' && <MultipleChoice q={q} state={state} dispatch={dispatch} />}
        {q.type === 'fill' && <FillBlank q={q} state={state} dispatch={dispatch} />}
        {q.type === 'order' && <OrderPieces q={q} state={state} dispatch={dispatch} />}
        {q.type === 'open' && <OpenQuestion key={q.id} q={q} lang={lang} answered={!!f} dispatch={dispatch} />}
      </main>

      {(q.type !== 'open' || f) && (
        <div className={'footer' + (f?.kind === 'ok' ? ' ok' : f?.kind === 'bad' ? ' bad' : '')}>
          <div className="in">
            {f ? (
              <>
                <div className="fb">
                  <h3>{f.title}</h3>
                  {!!f.xp && <p>+{f.xp} XP</p>}
                  {f.solution && <p className="sol">{f.solution}</p>}
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
                <button id="continue-btn" className={'btn' + (f.kind === 'ok' ? ' ok' : f.kind === 'bad' ? ' bad' : '')} onClick={() => dispatch({ type: 'next' })} autoFocus>Continuar</button>
              </>
            ) : (
              <>
                <div className="fb" />
                <button className="btn" disabled={!canCheck(state)} onClick={() => dispatch({ type: 'check' })}>Comprobar</button>
              </>
            )}
          </div>
        </div>
      )}

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
      <div className="kind">Elige la respuesta</div>
      <div className="q"><Rich text={q.prompt} /></div>
      <div className="opts">
        {state.options.map((o, i) => {
          const cls = ['opt', looksLikeCode(o.text) && 'code', !f && state.selected === i && 'sel', f && o.correct && 'right', f && state.selected === i && !o.correct && 'wrong'];
          return (
            <button key={o.text} className={cls.filter(Boolean).join(' ')} disabled={!!f} onClick={() => dispatch({ type: 'select', index: i })}>
              <span className="k">{i + 1}</span><span className="t">{o.text}</span>
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
      <div className={'sentence' + (looksLikeCode(q.prompt) ? ' mono' : '')}>
        {before}<span className="blank">{state.selected !== null ? state.options[state.selected].text : ' '}</span>{rest.join('___')}
      </div>
      <div className="chips">
        {state.options.map((o, i) => {
          const cls = ['chip', !f && state.selected === i && 'sel', f && o.correct && 'right', f && state.selected === i && !o.correct && 'wrong'];
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

function OpenQuestion({ q, lang, answered, dispatch }: { q: Question; lang: 'en' | 'es'; answered: boolean; dispatch: Dispatch }) {
  const [answer, setAnswer] = useState('');
  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<Grade | null>(null);
  const [note, setNote] = useState('');
  const [selfAssess, setSelfAssess] = useState(false);
  const model = lang === 'es' ? (q.model_es || q.model_en || '') : (q.model_en || q.model_es || '');
  const color = (s: number) => (s >= 75 ? 'var(--ok)' : s >= PASS_SCORE ? 'var(--accent)' : 'var(--bad)');

  async function evaluate() {
    setGrading(true);
    const r = await gradeAnswer(q.id, answer.trim(), lang);
    setGrading(false);
    if ('error' in r) {
      setNote(r.error === 'daily_limit'
        ? 'Has usado todas las correcciones automáticas de hoy. Compara tu respuesta con la respuesta modelo.'
        : 'La corrección automática no está disponible ahora. Compara tu respuesta con la respuesta modelo.');
      setSelfAssess(true);
      return;
    }
    setGrade(r);
    const pass = r.score >= PASS_SCORE;
    dispatch({ type: 'openResult', pass, xp: pass ? Math.round(r.score / 5) : 5, title: pass ? '¡Buena respuesta!' : 'Hay que pulirla' });
  }

  function selfGrade(ok: boolean) {
    setSelfAssess(false);
    dispatch({ type: 'openResult', pass: ok, xp: ok ? 15 : 5, title: ok ? '¡Bien!' : 'Apuntada para mejorar' });
  }

  return (
    <>
      <div className="kind">Pregunta de entrevista</div>
      <div className="q">{q.prompt}</div>
      {lang === 'en' && q.prompt_en && <div className="q-sub">En la entrevista: “{q.prompt_en}”</div>}
      <div className="q-sub">{lang === 'en' ? 'Respóndelo en inglés, como lo dirías en voz alta.' : 'Respóndelo como lo dirías en voz alta.'}</div>
      <textarea id="open-answer" value={answer} onChange={(e) => setAnswer(e.target.value)} readOnly={grading || !!grade || selfAssess || answered}
        placeholder={lang === 'en' ? 'Write your answer in English…' : 'Escribe tu respuesta…'} aria-label="Tu respuesta" />
      {grading && <div className="thinking"><span className="dots"><i /><i /><i /></span>Tu entrevistador está leyendo la respuesta…</div>}
      {note && <p className="small muted">{note}</p>}
      {grade && (
        <div className="grade">
          <div className="score">
            <div className="num" style={{ color: color(grade.score) }}>{grade.score}</div>
            <div className="meter"><span style={{ width: `${grade.score}%`, background: color(grade.score) }} /></div>
          </div>
          {grade.strengths.length > 0 && <div><h4>Lo que funciona</h4><ul>{grade.strengths.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {grade.improve.length > 0 && <div><h4>Para mejorar</h4><ul>{grade.improve.map((s, i) => <li key={i}>{s}</li>)}</ul></div>}
          {grade.language.length > 0 && (
            <div><h4>Inglés</h4>{grade.language.map((x, i) => <div className="fix" key={i}><s>{x.wrong}</s>→<b>{x.right}</b></div>)}</div>
          )}
          {grade.better && <div><h4>Tu respuesta, mejorada</h4><div className="better">{grade.better}</div></div>}
        </div>
      )}
      {selfAssess && (
        <div className="grade">
          <div><h4>Respuesta modelo</h4><div className="better">{model}</div></div>
          {q.keys && <div><h4>Una buena respuesta incluye</h4><p style={{ margin: 0 }}>{q.keys}</p></div>}
        </div>
      )}
      {!answered && (
        <div className="footer">
          <div className="in">
            {selfAssess ? (
              <>
                <div className="fb"><h3>¿Cómo te salió?</h3><p>Sé sincero: esto solo lo ves tú.</p></div>
                <button className="btn ghost" onClick={() => selfGrade(false)}>Me faltó</button>
                <button className="btn ok" onClick={() => selfGrade(true)}>La tenía</button>
              </>
            ) : (
              <>
                <div className="fb" />
                <button className="btn" disabled={answer.trim().length < 3 || grading} onClick={evaluate}>Evaluar</button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
