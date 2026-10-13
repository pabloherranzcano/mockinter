import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { sendReport } from '../lib/api';
import { REASONS, type ReportReason } from '../lib/models';

export function ReportDialog({ questionId, onClose }: { questionId: string; onClose: () => void }) {
  const { session } = useAuth();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!reason || !session) return;
    setSending(true); setError('');
    try {
      await sendReport(session.user.id, questionId, reason, comment);
      setSent(true);
    } catch (err) {
      const msg = (err as Error)?.message ?? '';
      setError(msg.includes('muchos reportes') ? msg : 'No se pudo enviar. Inténtalo de nuevo en un momento.');
    } finally { setSending(false); }
  }

  return (
    <div className="overlay" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="rep-title">
        {!sent ? (
          <>
            <h2 id="rep-title">Reportar esta pregunta</h2>
            <p className="muted small" style={{ margin: 0 }}>Lo revisamos a mano y corregimos la pregunta. Gracias por ayudar a mejorarla.</p>
            <div className="stack" role="radiogroup" aria-label="Motivo">
              {REASONS.map((r) => (
                <label key={r.code} className="radio">
                  <input type="radio" name="reason" value={r.code} checked={reason === r.code} onChange={() => setReason(r.code)} /> {r.label}
                </label>
              ))}
            </div>
            <label className="field">Comentario (opcional)
              <textarea id="report-comment" value={comment} maxLength={1000} onChange={(e) => setComment(e.target.value)}
                placeholder="Por ejemplo: la opción B también es correcta porque…" />
            </label>
            {error && <div className="error">{error}</div>}
            <div className="row">
              <button type="button" className="btn ghost sm" onClick={onClose}>Cancelar</button>
              <span className="spacer" />
              <button type="submit" className="btn sm" disabled={!reason || sending}>{sending ? 'Enviando…' : 'Enviar'}</button>
            </div>
          </>
        ) : (
          <>
            <h2 id="rep-title">Gracias</h2>
            <p style={{ margin: 0 }}>Hemos recibido tu reporte. Si hace falta, corregiremos la pregunta en los próximos días.</p>
            <button type="button" className="btn full" onClick={onClose} autoFocus>Seguir</button>
          </>
        )}
      </form>
    </div>
  );
}
