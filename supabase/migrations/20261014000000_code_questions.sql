-- v2: preguntas tipo test con código, sin preguntas abiertas ni corrección con IA.

-- 1. Campo de código en las preguntas
alter table public.questions add column if not exists code text;

-- 2. Fuera las preguntas abiertas y todo lo que solo usaban ellas
delete from public.questions where type = 'open';
alter table public.questions drop constraint if exists questions_type_check;
alter table public.questions add constraint questions_type_check check (type in ('mc', 'fill', 'order'));
alter table public.questions
  drop column if exists prompt_en,
  drop column if exists keys,
  drop column if exists model_en,
  drop column if exists model_es;

drop function if exists public.consume_grading(uuid, integer);
drop table if exists public.grading_usage;

-- 3. Bloques compartidos: FE (Angular y React) y DEV (todos los puestos técnicos)
comment on column public.topics.role is
  'ANG, REA, CLD, BCK = un puesto; FE = Angular y React; DEV = todos los puestos técnicos; COM = todos';
