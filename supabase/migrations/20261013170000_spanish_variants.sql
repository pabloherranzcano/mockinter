-- Variante de cada pregunta para quien tiene la entrevista en español.
-- Si un campo es null, la app usa la versión normal de la pregunta.
alter table public.questions
  add column if not exists es_prompt      text,
  add column if not exists es_correct     text,
  add column if not exists es_wrong       text[],
  add column if not exists es_explanation text;
