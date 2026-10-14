/**
 * Bloque de código con resaltado mínimo (comentarios, cadenas, palabras clave y números).
 * No usa innerHTML: cada trozo es un <span> que React escapa.
 */
const KEYWORDS = new Set([
  // TS / JS
  'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'of', 'in', 'new', 'class', 'export', 'import', 'from',
  'async', 'await', 'type', 'interface', 'extends', 'implements', 'private', 'public', 'readonly', 'true', 'false', 'null',
  'undefined', 'this', 'switch', 'case', 'default', 'throw', 'try', 'catch', 'typeof', 'keyof', 'infer', 'satisfies', 'never',
  // Java
  'void', 'int', 'long', 'boolean', 'String', 'static', 'final', 'record',
  // SQL
  'SELECT', 'FROM', 'WHERE', 'JOIN', 'LEFT', 'ON', 'GROUP', 'BY', 'ORDER', 'AND', 'OR', 'DESC', 'COUNT', 'INSERT', 'UPDATE',
  // Docker / YAML
  'FROM', 'WORKDIR', 'COPY', 'RUN', 'CMD', 'AS',
]);

const TOKEN = /(\/\/[^\n]*|<!--[\s\S]*?-->|#[^\n{]*$|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`|@\w+|\b\d+(?:\.\d+)?\b|\b[A-Za-z_]\w*\b)/gm;

type Part = { t: string; c?: 'com' | 'str' | 'kw' | 'num' | 'dec' };

export function tokenize(code: string): Part[] {
  const parts: Part[] = [];
  let last = 0;
  for (const m of code.matchAll(TOKEN)) {
    const tok = m[0];
    const i = m.index ?? 0;
    if (i > last) parts.push({ t: code.slice(last, i) });
    let c: Part['c'];
    if (tok.startsWith('//') || tok.startsWith('<!--') || (tok.startsWith('#') && !/^#\w/.test(tok))) c = 'com';
    else if (/^['"`]/.test(tok)) c = 'str';
    else if (tok.startsWith('@')) c = 'dec';
    else if (/^\d/.test(tok)) c = 'num';
    else if (KEYWORDS.has(tok)) c = 'kw';
    parts.push(c ? { t: tok, c } : { t: tok });
    last = i + tok.length;
  }
  if (last < code.length) parts.push({ t: code.slice(last) });
  return parts;
}

export function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="code-block" tabIndex={0} aria-label="Fragmento de código">
      <code>
        {tokenize(code).map((p, i) => (p.c ? <span key={i} className={'tk-' + p.c}>{p.t}</span> : p.t))}
      </code>
    </pre>
  );
}
