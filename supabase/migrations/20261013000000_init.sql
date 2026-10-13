-- mockinter.dev: esquema inicial
-- Tablas: profiles, topics, questions, progress, wrong_answers, reports, grading_usage
-- Seguridad: Row Level Security en todas las tablas. Solo el rol 'admin' puede editar el contenido.

-- ============ PERFILES ============
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  role          text not null default 'user' check (role in ('user','admin')),
  target_role   text,                       -- puesto que busca: 'ANG','REA','CLD','BCK'
  level         text check (level in ('Junior','Mid','Senior')),
  english       text check (english in ('yes','no','partial')),
  onboarded     boolean not null default false,
  xp            integer not null default 0,
  streak        integer not null default 0,
  last_day      date,
  day_xp        integer not null default 0,
  day_xp_date   date,
  created_at    timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ¿El usuario actual es admin?
create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Un usuario no puede cambiarse el rol, la XP ni la racha a sí mismo
create function public.protect_profile() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- Solo se aplica a peticiones de usuarios de la app (no al editor SQL ni al service role)
  if current_setting('mockinter.trusted', true) = 'on' or coalesce(auth.role(), '') <> 'authenticated' then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'No puedes cambiar tu rol';
  end if;
  if (new.xp, new.streak, new.last_day, new.day_xp, new.day_xp_date)
     is distinct from (old.xp, old.streak, old.last_day, old.day_xp, old.day_xp_date) then
    raise exception 'La XP solo se actualiza al terminar una lección';
  end if;
  return new;
end $$;

create trigger protect_profile_trg
  before update on public.profiles
  for each row execute function public.protect_profile();

alter table public.profiles enable row level security;
create policy "ver mi perfil" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "editar mi perfil" on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- ============ TEMAS ============
create table public.topics (
  id          text primary key,           -- p. ej. 'ANG-01'
  role        text not null,              -- 'ANG','REA','CLD','BCK','COM'
  role_name   text not null,              -- 'Frontend Angular'
  name        text not null,
  position    integer not null,
  is_english  boolean not null default false,  -- se oculta si la entrevista no es en inglés
  active      boolean not null default true
);
alter table public.topics enable row level security;
create policy "leer temas" on public.topics for select using (active or public.is_admin());
create policy "admin escribe temas" on public.topics for all using (public.is_admin()) with check (public.is_admin());

-- ============ PREGUNTAS ============
create table public.questions (
  id           text primary key,          -- p. ej. 'ANG-01-J1'
  topic_id     text not null references public.topics(id) on update cascade,
  level        text not null check (level in ('Junior','Mid','Senior')),
  type         text not null check (type in ('mc','fill','order','open')),
  prompt       text not null,             -- pregunta en español
  prompt_en    text,                      -- original en inglés (abiertas)
  correct      text,                      -- respuesta correcta (order: piezas separadas por ' | ')
  wrong        text[] not null default '{}',
  explanation  text,
  say_en       text,                      -- frase ejemplo para decir en la entrevista
  say_es       text,
  keys         text,                      -- puntos clave (abiertas)
  model_en     text,                      -- respuesta modelo en inglés
  model_es     text,                      -- respuesta modelo en español
  status       text not null default 'pending' check (status in ('pending','reviewed','discarded')),
  active       boolean not null default true,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references auth.users(id)
);
create index on public.questions (topic_id, level);

create function public.touch_question() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger touch_question_trg before update on public.questions
  for each row execute function public.touch_question();

alter table public.questions enable row level security;
create policy "leer preguntas activas" on public.questions for select
  using ((active and status <> 'discarded') or public.is_admin());
create policy "admin escribe preguntas" on public.questions for all
  using (public.is_admin()) with check (public.is_admin());

-- ============ PROGRESO ============
create table public.progress (
  user_id      uuid not null references auth.users(id) on delete cascade,
  topic_id     text not null references public.topics(id) on update cascade on delete cascade,
  level        text not null,
  best_stars   integer not null default 0 check (best_stars between 0 and 3),
  completed_at timestamptz not null default now(),
  primary key (user_id, topic_id, level)
);
alter table public.progress enable row level security;
create policy "mi progreso" on public.progress for select using (user_id = auth.uid());
-- se escribe solo mediante finish_lesson()

create table public.wrong_answers (
  user_id     uuid not null references auth.users(id) on delete cascade default auth.uid(),
  question_id text not null references public.questions(id) on update cascade on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, question_id)
);
alter table public.wrong_answers enable row level security;
create policy "mis fallos" on public.wrong_answers for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Termina una lección: guarda estrellas, suma XP y actualiza la racha (fecha de Madrid)
create function public.finish_lesson(p_topic text, p_level text, p_stars integer, p_xp integer)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Europe/Madrid')::date;
  p public.profiles;
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  p_xp := greatest(0, least(p_xp, 200));       -- tope por lección
  p_stars := greatest(0, least(p_stars, 3));

  if p_topic is not null then
    insert into progress (user_id, topic_id, level, best_stars)
    values (auth.uid(), p_topic, p_level, p_stars)
    on conflict (user_id, topic_id, level)
    do update set best_stars = greatest(progress.best_stars, excluded.best_stars), completed_at = now();
  end if;

  perform set_config('mockinter.trusted', 'on', true);
  update profiles set
    xp = xp + p_xp,
    day_xp = case when day_xp_date = today then day_xp + p_xp else p_xp end,
    day_xp_date = today,
    streak = case
      when last_day = today then streak
      when last_day = today - 1 then streak + 1
      else 1 end,
    last_day = today
  where id = auth.uid()
  returning * into p;
  perform set_config('mockinter.trusted', 'off', true);
  return p;
end $$;

-- ============ REPORTES ============
create table public.reports (
  id           bigint generated always as identity primary key,
  question_id  text not null references public.questions(id) on update cascade on delete cascade,
  user_id      uuid references auth.users(id) on delete set null default auth.uid(),
  reason       text not null check (reason in ('wrong_answer','unclear','typo','suggestion','other')),
  comment      text check (char_length(comment) <= 1000),
  status       text not null default 'open' check (status in ('open','resolved','dismissed')),
  admin_note   text,
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);
create index on public.reports (status, created_at desc);
alter table public.reports enable row level security;
create policy "crear reporte" on public.reports for insert to authenticated
  with check (user_id = auth.uid() and status = 'open');
create policy "ver reportes" on public.reports for select using (user_id = auth.uid() or public.is_admin());
create policy "admin gestiona reportes" on public.reports for update using (public.is_admin()) with check (public.is_admin());
create policy "admin borra reportes" on public.reports for delete using (public.is_admin());

-- Máximo 20 reportes al día por usuario (evita spam)
create function public.limit_reports() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from reports where user_id = new.user_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Has enviado muchos reportes hoy. Gracias, prueba mañana.';
  end if;
  return new;
end $$;
create trigger limit_reports_trg before insert on public.reports
  for each row execute function public.limit_reports();

-- ============ USO DE LA IA ============
-- Solo la función de servidor (service role) lee y escribe aquí.
create table public.grading_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day     date not null,
  count   integer not null default 0,
  primary key (user_id, day)
);
alter table public.grading_usage enable row level security;

create function public.consume_grading(p_user uuid, p_limit integer) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Europe/Madrid')::date;
  c integer;
begin
  insert into grading_usage (user_id, day, count) values (p_user, today, 1)
  on conflict (user_id, day) do update set count = grading_usage.count + 1
  returning count into c;
  return c <= p_limit;
end $$;
revoke execute on function public.consume_grading(uuid, integer) from public, anon, authenticated;

-- ============ BORRAR MI CUENTA (RGPD) ============
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  delete from auth.users where id = auth.uid();
end $$;

-- Permisos de las funciones públicas
revoke execute on function public.finish_lesson(text, text, integer, integer) from public, anon;
grant execute on function public.finish_lesson(text, text, integer, integer) to authenticated;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
