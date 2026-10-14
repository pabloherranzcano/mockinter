import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAllTopics, fetchQuestion, fetchReports, nextQuestionId, saveQuestion, setReportStatus } from '../lib/api';
import { TYPE_LABELS, type Level, type QStatus, type QType, type Question } from '../lib/models';
import { reasonLabel } from './AdminReports';
import { CodeBlock } from '../components/CodeBlock';

const blank = (): Question => ({
  id: '', topic_id: '', level: 'Mid', type: 'mc', prompt: '', code: null, correct: '', wrong: ['', '', ''],
  explanation: '', say_en: null, say_es: null, status: 'reviewed', active: true,
});

/** Comprueba que la pregunta está completa. Devuelve el problema o null. */
export function validateQuestion(q: Question, orderText: string): string | null {
  if (!q.topic_id) return 'Elige un tema.';
  if (!q.prompt.trim()) return 'Escribe la pregunta.';
  if (q.type === 'fill' && !q.prompt.includes('___')) return 'La frase necesita ___ donde va el hueco.';
  if (q.type === 'mc' || q.type === 'fill') {
    if (!q.correct?.trim()) return 'Falta la respuesta correcta.';
    if (!q.wrong.some((w) => w.trim())) return 'Añade al menos una opción incorrecta.';
  }
  if (q.type === 'order' && orderText.split('\n').filter((l) => l.trim()).length < 2) return 'Pon al menos dos piezas, una por línea.';
  return null;
}

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const v = (s: string | null | undefined) => s ?? '';

export default function QuestionEditor() {
  const { id = 'nueva' } = useParams();
  const isNew = id === 'nueva';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const topicsQ = useQuery({ queryKey: ['allTopics'], queryFn: fetchAllTopics });
  const questionQ = useQuery({ queryKey: ['question', id], queryFn: () => fetchQuestion(id), enabled: !isNew });
  const reportsQ = useQuery({ queryKey: ['reports', 'all'], queryFn: () => fetchReports('all'), enabled: !isNew });

  const [q, setQ] = useState<Question>(blank);
  const [orderText, setOrderText] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const patch = (p: Partial<Question>) => { setQ((x) => ({ ...x, ...p })); setSaved(false); };

  // Cargar la pregunta en el formulario cuando llega (o al cambiar de pregunta)
  useEffect(() => {
    if (isNew) { setQ(blank()); setOrderText(''); return; }
    const data = questionQ.data;
    if (data) {
      setQ({ ...data, wrong: data.wrong.length ? [...data.wrong] : [''] });
      setOrderText(data.type === 'order' ? (data.correct ?? '').split(' | ').join('\n') : '');
    }
  }, [isNew, questionQ.data]);

  const reports = (reportsQ.data ?? []).filter((r) => r.question_id === id);
  const openReports = reports.filter((r) => r.status === 'open');

  const save = useMutation({
    mutationFn: async () => {
      const row: Question = {
        ...q,
        wrong: q.type === 'mc' || q.type === 'fill' ? q.wrong.map((w) => w.trim()).filter(Boolean) : [],
        es_wrong: q.es_wrong?.map((w) => w.trim()).filter(Boolean).length ? q.es_wrong.map((w) => w.trim()).filter(Boolean) : null,
        correct: q.type === 'order'
          ? orderText.split('\n').map((l) => l.trim()).filter(Boolean).join(' | ')
          : q.correct?.trim() ?? null,
        code: q.code?.replace(/\s+$/, '') || null,
      };
      if (isNew) row.id = await nextQuestionId(row.topic_id, row.level as Level);
      return saveQuestion(row, isNew);
    },
    onSuccess: (savedQ) => {
      setSaved(true);
      qc.setQueryData(['question', savedQ.id], savedQ);
      void qc.invalidateQueries({ queryKey: ['adminQuestions'] });
      if (isNew) navigate(`/admin/questions/${savedQ.id}`, { replace: true });
    },
    onError: (e) => setError('No se pudo guardar: ' + ((e as Error)?.message ?? 'error desconocido')),
  });

  const resolveAll = useMutation({
    mutationFn: () => setReportStatus(openReports.map((r) => r.id), 'resolved'),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports'] });
      void qc.invalidateQueries({ queryKey: ['openReportCounts'] });
    },
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(''); setSaved(false);
    const problem = validateQuestion(q, orderText);
    if (problem) { setError(problem); return; }
    save.mutate();
  }

  if (!isNew && questionQ.isLoading) return <p className="muted" style={{ marginTop: 18 }}>Cargando…</p>;
  if (!isNew && !questionQ.data) return <div className="error" style={{ marginTop: 18 }}>No existe la pregunta {id}.</div>;

  return (
    <>
      <div className="row" style={{ marginTop: 18 }}><Link className="link small" to="/admin/questions">← Preguntas</Link></div>
      <div className="row" style={{ marginTop: 8 }}>
        <h2 style={{ fontSize: '1.5rem' }}>{isNew ? 'Nueva pregunta' : 'Editar pregunta'}</h2>
        {!isNew && <code>{q.id}</code>}
        <span className="spacer" />
        <label className="row small" style={{ gap: 8, fontWeight: 600 }}>Visible
          <span className="switch"><input id="q-active" type="checkbox" checked={q.active} onChange={(e) => patch({ active: e.target.checked })} /><span /></span>
        </label>
      </div>

      <form className="editor" style={{ marginTop: 16 }} onSubmit={submit}>
        <div className="card stack">
          <div className="grid2">
            <label className="field">Tema
              <select id="ed-topic" value={q.topic_id} onChange={(e) => patch({ topic_id: e.target.value })}>
                <option value="" disabled>Elige un tema</option>
                {(topicsQ.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.role_name} · {t.name}</option>)}
              </select>
            </label>
            <label className="field">Nivel
              <select id="ed-level" value={q.level} onChange={(e) => patch({ level: e.target.value as Level })}>
                <option>Junior</option><option>Mid</option><option>Senior</option>
              </select>
            </label>
            <label className="field">Tipo
              <select id="ed-type" value={q.type} disabled={!isNew} onChange={(e) => patch({ type: e.target.value as QType })}>
                {(Object.entries(TYPE_LABELS) as [QType, string][]).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </label>
            <label className="field">Revisión
              <select id="ed-status" value={q.status} onChange={(e) => patch({ status: e.target.value as QStatus })}>
                <option value="pending">Pendiente de revisar</option><option value="reviewed">Revisada</option><option value="discarded">Descartada</option>
              </select>
            </label>
          </div>

          <label className="field">{q.type === 'fill' ? 'Frase (pon ___ donde va el hueco)' : 'Pregunta (en español)'}
            <textarea id="ed-prompt" value={q.prompt} onChange={(e) => patch({ prompt: e.target.value })} style={{ minHeight: 80 }} />
          </label>

          <label className="field">Código (opcional: se muestra como bloque encima de las opciones)
            <textarea id="ed-code" className="code-input" value={v(q.code)} spellCheck={false}
              onChange={(e) => patch({ code: e.target.value || null })} style={{ minHeight: 120 }}
              placeholder={'const total = computed(() => price() * qty());'} />
          </label>
          {q.code && <CodeBlock code={q.code} />}

          {q.type === 'order' && (
            <label className="field">Piezas en el orden correcto (una por línea)
              <textarea id="ed-items" value={orderText} onChange={(e) => { setOrderText(e.target.value); setSaved(false); }} style={{ minHeight: 140 }} />
            </label>
          )}

          {(q.type === 'mc' || q.type === 'fill') && (
            <>
              <label className="field">Respuesta correcta
                <input id="ed-correct" type="text" value={v(q.correct)} onChange={(e) => patch({ correct: e.target.value })} />
              </label>
              {q.wrong.map((w, i) => (
                <div className="row" style={{ alignItems: 'end' }} key={i}>
                  <label className="field" style={{ flex: 1 }}>Incorrecta {i + 1}
                    <input id={`ed-wrong-${i}`} type="text" value={w} onChange={(e) => patch({ wrong: q.wrong.map((x, j) => (j === i ? e.target.value : x)) })} />
                  </label>
                  {q.wrong.length > 1 && (
                    <button type="button" className="btn ghost sm" aria-label={`Quitar incorrecta ${i + 1}`}
                      onClick={() => patch({ wrong: q.wrong.filter((_, j) => j !== i) })}>Quitar</button>
                  )}
                </div>
              ))}
              {q.wrong.length < 5 && (
                <button type="button" className="link small" style={{ justifySelf: 'start' }} onClick={() => patch({ wrong: [...q.wrong, ''] })}>+ Añadir opción incorrecta</button>
              )}
            </>
          )}

          {(
            <>
              <label className="field">Explicación (se muestra tras responder)
                <textarea id="ed-expl" value={v(q.explanation)} onChange={(e) => patch({ explanation: e.target.value })} />
              </label>
              <div className="grid2">
                <label className="field">Frase ejemplo para decir (inglés, opcional)
                  <textarea id="ed-say-en" value={v(q.say_en)} onChange={(e) => patch({ say_en: e.target.value || null })} style={{ minHeight: 80 }} />
                </label>
                <label className="field">Traducción del ejemplo
                  <textarea id="ed-say-es" value={v(q.say_es)} onChange={(e) => patch({ say_es: e.target.value || null })} style={{ minHeight: 80 }} />
                </label>
              </div>
            </>
          )}

          {q.type !== 'order' && (
            <details className="stack" open={!!(q.es_prompt || q.es_correct || q.es_wrong?.length || q.es_explanation)}>
              <summary style={{ cursor: 'pointer', fontWeight: 700 }}>Variante para entrevistas en español (opcional)</summary>
              <p className="muted small" style={{ margin: '8px 0' }}>
                Rellénala solo si el enunciado, las opciones o la explicación tienen frases en inglés. Lo que dejes vacío usa la versión normal.
              </p>
              <div className="stack">
                <label className="field">Pregunta en español
                  <textarea id="ed-es-prompt" value={v(q.es_prompt)} onChange={(e) => patch({ es_prompt: e.target.value || null })} style={{ minHeight: 70 }} />
                </label>
                <label className="field">Respuesta correcta en español
                  <input id="ed-es-correct" type="text" value={v(q.es_correct)} onChange={(e) => patch({ es_correct: e.target.value || null })} />
                </label>
                <label className="field">Incorrectas en español (una por línea)
                  <textarea id="ed-es-wrong" value={(q.es_wrong ?? []).join('\n')} style={{ minHeight: 90 }}
                    onChange={(e) => patch({ es_wrong: e.target.value.split('\n').some((l) => l.trim()) ? e.target.value.split('\n') : null })} />
                </label>
                <label className="field">Explicación en español
                  <textarea id="ed-es-expl" value={v(q.es_explanation)} onChange={(e) => patch({ es_explanation: e.target.value || null })} />
                </label>
              </div>
            </details>
          )}

          {error && <div className="error">{error}</div>}
          {saved && <div className="notice">Guardada. Los usuarios ya ven la nueva versión.</div>}
          <div className="row">
            <Link className="btn ghost" to="/admin/questions">Cancelar</Link>
            <span className="spacer" />
            <button type="submit" className="btn" disabled={save.isPending}>{save.isPending ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </div>

        <aside className="stack">
          <div className="card stack">
            <p className="eyebrow" style={{ margin: 0 }}>Reportes de esta pregunta</p>
            {reports.length === 0 && <p className="muted small" style={{ margin: 0 }}>Sin reportes.</p>}
            {reports.map((r) => (
              <div className="report-item" key={r.id}>
                <div className="small"><strong>{reasonLabel(r.reason)}</strong> · <span className="muted">{fmt.format(new Date(r.created_at))}</span>
                  {r.status !== 'open' && <> · <span className="muted">{r.status === 'resolved' ? 'resuelto' : 'descartado'}</span></>}</div>
                {r.comment && <p style={{ margin: '4px 0 0' }} className="small">{r.comment}</p>}
              </div>
            ))}
            {openReports.length > 0 && (
              <button type="button" className="btn ok sm" disabled={resolveAll.isPending} onClick={() => resolveAll.mutate()}>
                Marcar {openReports.length} como resueltos
              </button>
            )}
          </div>
          {q.updated_at && <p className="muted small">Última edición: {fmt.format(new Date(q.updated_at))}</p>}
        </aside>
      </form>
    </>
  );
}
