/** Muestra texto convirtiendo `código` entre comillas invertidas en <code>. React escapa el resto: no se interpreta HTML. */
export function Rich({ text }: { text?: string | null }) {
  const parts = String(text ?? '').split(/(`[^`]+`)/).filter(Boolean);
  return (
    <>
      {parts.map((p, i) => (/^`[^`]+`$/.test(p) ? <code key={i}>{p.slice(1, -1)}</code> : <span key={i}>{p}</span>))}
    </>
  );
}
