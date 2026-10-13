#!/usr/bin/env python3
"""
Convierte Temario_Racha.xlsx en un archivo SQL para cargar las preguntas en Supabase.

Uso:
    pip install openpyxl
    python scripts/import_xlsx.py Temario_Racha.xlsx                 # genera supabase/seed.sql
    python scripts/import_xlsx.py Temario_Racha.xlsx --overwrite     # sobrescribe preguntas existentes

Por defecto las preguntas que ya existen en la base de datos NO se tocan, para no pisar
lo que hayas cambiado desde el panel de admin. Con --overwrite, el Excel manda.

Las filas con Estado = «Descartada» se omiten. Activa = «No» se importa oculta.
"""
import sys
from pathlib import Path
from openpyxl import load_workbook

ROLE_CODES = {
    "Frontend Angular": "ANG", "Frontend React": "REA", "Cloud / DevOps (AWS)": "CLD",
    "Backend Java/Spring": "BCK", "Común (todos los puestos)": "COM",
}
TYPES = {"Elegir respuesta": "mc", "Completar frase": "fill", "Ordenar": "order", "Respuesta abierta": "open"}
STATUS = {"Pendiente de revisar": "pending", "Revisada": "reviewed", "Descartada": "discarded"}
ENGLISH_TOPICS = {"Inglés de entrevista"}


def q(v):
    """Literal SQL de texto (o NULL)."""
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return "null"
    return "'" + str(v).replace("'", "''") + "'"


def arr(values):
    vals = [v for v in values if v not in (None, "")]
    if not vals:
        return "'{}'::text[]"
    return "array[" + ", ".join(q(v) for v in vals) + "]::text[]"


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    src = Path(sys.argv[1]); overwrite = "--overwrite" in sys.argv
    ws = load_workbook(src, data_only=True)["Preguntas"]
    rows = list(ws.iter_rows(values_only=True))
    head = {h: i for i, h in enumerate(rows[0])}
    col = lambda r, name: r[head[name]] if name in head else None

    topics, questions, skipped = {}, [], 0
    for r in rows[1:]:
        qid = col(r, "ID")
        if not qid:
            continue
        if col(r, "Estado") == "Descartada":
            skipped += 1; continue
        role_name = col(r, "Puesto"); topic = col(r, "Tema")
        code = ROLE_CODES.get(role_name)
        if not code:
            print(f"Aviso: puesto desconocido en {qid}: {role_name}"); continue
        parts = str(qid).split("-")
        topic_id = f"{parts[0]}-{parts[1]}"
        topics.setdefault(topic_id, (code, role_name, topic, int(parts[1]), topic in ENGLISH_TOPICS))
        t = TYPES.get(col(r, "Tipo"))
        if not t:
            print(f"Aviso: tipo desconocido en {qid}"); continue
        questions.append(dict(
            id=qid, topic_id=topic_id, level=col(r, "Nivel"), type=t,
            prompt=col(r, "Pregunta (ES)"), prompt_en=col(r, "Pregunta original (EN)"),
            correct=col(r, "Respuesta correcta"),
            wrong=[col(r, "Incorrecta 1"), col(r, "Incorrecta 2"), col(r, "Incorrecta 3")],
            explanation=col(r, "Explicación"), say_en=col(r, "Frase ejemplo (EN)"),
            say_es=col(r, "Traducción del ejemplo"), keys=col(r, "Puntos clave (abiertas)"),
            model_en=col(r, "Respuesta modelo (EN)"), model_es=col(r, "Respuesta modelo (ES)"),
            status=STATUS.get(col(r, "Estado"), "pending"), active=(col(r, "Activa") != "No"),
        ))

    out = ["-- Generado por scripts/import_xlsx.py desde " + src.name, "begin;"]
    for tid, (code, role_name, name, pos, is_en) in sorted(topics.items()):
        out.append(
            f"insert into public.topics (id, role, role_name, name, position, is_english) values "
            f"({q(tid)}, {q(code)}, {q(role_name)}, {q(name)}, {pos}, {'true' if is_en else 'false'}) "
            f"on conflict (id) do update set role_name = excluded.role_name, name = excluded.name, "
            f"position = excluded.position, is_english = excluded.is_english;")
    cols = ["id", "topic_id", "level", "type", "prompt", "prompt_en", "correct", "wrong", "explanation",
            "say_en", "say_es", "keys", "model_en", "model_es", "status", "active"]
    conflict = ("do update set " + ", ".join(f"{c} = excluded.{c}" for c in cols[1:])) if overwrite else "do nothing"
    for d in questions:
        vals = [q(d[c]) if c not in ("wrong", "active") else (arr(d[c]) if c == "wrong" else ("true" if d[c] else "false")) for c in cols]
        out.append(f"insert into public.questions ({', '.join(cols)}) values ({', '.join(vals)}) on conflict (id) {conflict};")
    out.append("commit;")

    dest = Path(__file__).resolve().parent.parent / "supabase" / "seed.sql"
    dest.write_text("\n".join(out) + "\n", encoding="utf-8")
    print(f"{len(topics)} temas y {len(questions)} preguntas -> {dest} ({skipped} descartadas omitidas)"
          + (" [modo sobrescribir]" if overwrite else ""))


if __name__ == "__main__":
    main()
