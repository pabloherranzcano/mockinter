import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchAdminQuestions, fetchAllTopics, fetchOpenReportCounts, setQuestionActive } from '../lib/api';
import { TYPE_LABELS, type Question } from '../lib/models';

interface Filters { search: string; role: string; topicId: string; level: string; state: string; }

export default function AdminQuestions() {
  const qc = useQueryClient();
  const questionsQ = useQuery({ queryKey: ['adminQuestions'], queryFn: fetchAdminQuestions });
  const topicsQ = useQuery({ queryKey: ['allTopics'], queryFn: fetchAllTopics });
  const reportsQ = useQuery({ queryKey: ['openReportCounts'], queryFn: fetchOpenReportCounts });
  const [f, setF] = useState<Filters>({ search: '', role: '', topicId: '', level: '', state: '' });
  const set = (patch: Partial<Filters>) => setF((x) => ({ ...x, ...patch }));

  const toggle = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => setQuestionActive(id, active),
    onMutate: ({ id, active }) => {
      // Actualización optimista: el interruptor responde al instante
      qc.setQueryData<Question[]>(['adminQuestions'], (list) => list?.map((q) => (q.id === id ? { ...q, active } : q)));
    },
    onError: () => void qc.invalidateQueries({ queryKey: ['adminQuestions'] }),
  });

  const topics = topicsQ.data ?? [];
  const roles = useMemo(() => [...new Map(topics.map((t) => [t.role, t.role_name]))].map(([code, name]) => ({ code, name })), [topics]);
  const topicsForRole = topics.filter((t) => !f.role || t.role === f.role);
  const all = questionsQ.data ?? [];
  const rep = reportsQ.data ?? new Map<string, number>();
  const s = f.search.trim().toLowerCase();
  const filtered = all.filter((q) =>
    (!f.role || q.topic_id.startsWith(f.role + '-')) &&
    (!f.topicId || q.topic_id === f.topicId) &&
    (!f.level || q.level === f.level) &&
    (!f.state || (f.state === 'active' ? q.active : f.state === 'hidden' ? !q.active : f.state === 'reported' ? rep.has(q.id) : q.status === f.state)) &&
    (!s || q.id.toLowerCase().includes(s) || q.prompt.toLowerCase().includes(s) || (q.correct ?? '').toLowerCase().includes(s)));

  return (
    <>
      <div className="row" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: '1.5rem' }}>Preguntas</h2>
        <span className="badge soft">{filtered.length} de {all.length}</span>
        <span className="spacer" />
        <Link className="btn sm" to="/admin/preguntas/nueva">Nueva pregunta</Link>
      </div>

      <div className="filters">
        <label className="field">Buscar <input id="q-search" type="search" value={f.search} onChange={(e) => set({ search: e.target.value })} placeholder="Texto o ID" /></label>
        <label className="field">Puesto
          <select id="q-role" value={f.role} onChange={(e) => set({ role: e.target.value, topicId: '' })}>
            <option value="">Todos</option>
            {roles.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
          </select>
        </label>
        <label className="field">Tema
          <select id="q-topic" value={f.topicId} onChange={(e) => set({ topicId: e.target.value })}>
            <option value="">Todos</option>
            {topicsForRole.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <label className="field">Nivel
          <select id="q-level" value={f.level} onChange={(e) => set({ level: e.target.value })}>
            <option value="">Todos</option><option>Junior</option><option>Mid</option><option>Senior</option>
          </select>
        </label>
        <label className="field">Estado
          <select id="q-state" value={f.state} onChange={(e) => set({ state: e.target.value })}>
            <option value="">Todas</option><option value="active">Visibles</option><option value="hidden">Ocultas</option>
            <option value="pending">Pendientes de revisar</option><option value="reviewed">Revisadas</option><option value="reported">Con reportes abiertos</option>
          </select>
        </label>
      </div>

      {(questionsQ.isError || toggle.isError) && <div className="error">No se pudieron cargar o actualizar las preguntas.</div>}
      {questionsQ.isLoading && <p className="muted">Cargando…</p>}

      <div className="table-wrap">
        <table>
          <thead><tr><th>Visible</th><th>ID</th><th>Pregunta</th><th>Tipo</th><th>Nivel</th><th>Revisión</th><th>Reportes</th></tr></thead>
          <tbody>
            {filtered.map((q) => (
              <tr key={q.id} className={q.active ? '' : 'hidden-row'}>
                <td>
                  <label className="switch" aria-label={(q.active ? 'Ocultar ' : 'Mostrar ') + q.id}>
                    <input type="checkbox" checked={q.active} onChange={(e) => toggle.mutate({ id: q.id, active: e.target.checked })} /><span />
                  </label>
                </td>
                <td className="id">{q.id}</td>
                <td><Link to={`/admin/preguntas/${q.id}`}>{q.prompt}</Link></td>
                <td className="small">{TYPE_LABELS[q.type]}</td>
                <td className="small">{q.level}</td>
                <td className="small">{q.status === 'reviewed' ? 'Revisada' : q.status === 'discarded' ? 'Descartada' : 'Pendiente'}</td>
                <td>{rep.get(q.id) ? <span className="badge">{rep.get(q.id)}</span> : null}</td>
              </tr>
            ))}
            {!questionsQ.isLoading && filtered.length === 0 && (
              <tr><td colSpan={7} className="muted">Ninguna pregunta coincide con los filtros.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
