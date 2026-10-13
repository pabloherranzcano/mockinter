import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchReports, setReportStatus } from '../lib/api';
import { REASONS, TYPE_LABELS, type Report, type ReportStatus } from '../lib/models';

interface Group { questionId: string; prompt: string; meta: string; active: boolean; reports: Report[]; }

const fmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const reasonLabel = (r: string) => REASONS.find((x) => x.code === r)?.label ?? r;

export function groupReports(reports: Report[]): Group[] {
  const m = new Map<string, Group>();
  for (const r of reports) {
    const q = r.questions;
    const g = m.get(r.question_id) ?? {
      questionId: r.question_id, prompt: q?.prompt ?? '(pregunta borrada)',
      meta: q ? `${q.level} · ${TYPE_LABELS[q.type]}` : '', active: q?.active ?? false, reports: [],
    };
    g.reports.push(r);
    m.set(r.question_id, g);
  }
  return [...m.values()].sort((a, b) => b.reports.length - a.reports.length);
}

export default function AdminReports() {
  const [status, setStatus] = useState<ReportStatus | 'all'>('open');
  const qc = useQueryClient();
  const reportsQ = useQuery({ queryKey: ['reports', status], queryFn: () => fetchReports(status) });
  const groups = useMemo(() => groupReports(reportsQ.data ?? []), [reportsQ.data]);
  const mark = useMutation({
    mutationFn: ({ ids, to }: { ids: number[]; to: ReportStatus }) => setReportStatus(ids, to),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['reports'] });
      void qc.invalidateQueries({ queryKey: ['openReportCounts'] });
    },
  });

  return (
    <>
      <div className="row" style={{ marginTop: 18 }}>
        <h2 style={{ fontSize: '1.5rem' }}>Bandeja de reportes</h2>
        <span className="spacer" />
        <label className="field" style={{ gridAutoFlow: 'column', alignItems: 'center' }}>Mostrar
          <select id="report-status" value={status} onChange={(e) => setStatus(e.target.value as ReportStatus | 'all')}>
            <option value="open">Abiertos</option>
            <option value="resolved">Resueltos</option>
            <option value="dismissed">Descartados</option>
            <option value="all">Todos</option>
          </select>
        </label>
      </div>
      <p className="muted small">Agrupados por pregunta: arriba las que tienen más reportes. Corrige la pregunta y marca los reportes como resueltos.</p>

      {reportsQ.isLoading && <p className="muted">Cargando…</p>}
      {(reportsQ.isError || mark.isError) && <div className="error">No se pudieron cargar o actualizar los reportes.</div>}
      {!reportsQ.isLoading && groups.length === 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <strong>No hay reportes{status === 'open' ? ' abiertos' : ''}.</strong>
          <p className="muted" style={{ margin: '4px 0 0' }}>Cuando alguien reporte una pregunta desde la app, aparecerá aquí.</p>
        </div>
      )}

      <div className="stack" style={{ marginTop: 16 }}>
        {groups.map((g) => (
          <article className="card report-group" key={g.questionId}>
            <div className="row">
              <span className="badge">{g.reports.length}</span>
              <code>{g.questionId}</code>
              <span className="muted small">{g.meta}</span>
              {!g.active && <span className="badge soft">Oculta</span>}
              <span className="spacer" />
              <Link className="btn navy sm" to={`/admin/preguntas/${g.questionId}`}>Editar pregunta</Link>
            </div>
            <strong>{g.prompt}</strong>
            {g.reports.map((r) => (
              <div className="report-item" key={r.id}>
                <div className="row small">
                  <strong>{reasonLabel(r.reason)}</strong><span className="muted">{fmt.format(new Date(r.created_at))}</span>
                  {r.status !== 'open' && <span className="badge soft">{r.status === 'resolved' ? 'Resuelto' : 'Descartado'}</span>}
                </div>
                {r.comment && <p style={{ margin: '4px 0 0' }}>{r.comment}</p>}
              </div>
            ))}
            <div className="row">
              {status === 'open' ? (
                <>
                  <button className="btn ok sm" disabled={mark.isPending} onClick={() => mark.mutate({ ids: g.reports.map((r) => r.id), to: 'resolved' })}>Marcar resueltos</button>
                  <button className="btn ghost sm" disabled={mark.isPending} onClick={() => mark.mutate({ ids: g.reports.map((r) => r.id), to: 'dismissed' })}>Descartar</button>
                </>
              ) : (
                <button className="btn ghost sm" disabled={mark.isPending} onClick={() => mark.mutate({ ids: g.reports.map((r) => r.id), to: 'open' })}>Reabrir</button>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
