// Prueba el esquema y las reglas de seguridad en un Postgres en memoria (PGlite), sin tocar Supabase.
// Uso: npm run test:db
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const db = new PGlite();
const R = new URL('../supabase/', import.meta.url).pathname;
await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'service_role') $$;
grant usage on schema auth to anon, authenticated;
`);
for (const f of fs.readdirSync(R+'migrations').sort()) await db.exec(fs.readFileSync(R+'migrations/'+f,'utf8'));
await db.exec(`grant usage on schema public to anon, authenticated; grant all on all tables in schema public to anon, authenticated; grant all on all sequences in schema public to authenticated;`);
// Contenido de la versión anterior que el seed con --prune debe eliminar
await db.exec(`insert into topics (id, role, role_name, name, position) values ('ANG-01','ANG','Frontend Angular','Viejo',1);
  insert into questions (id, topic_id, level, type, prompt, correct, wrong) values ('ANG-01-J1','ANG-01','Junior','mc','vieja','a','{b}');`);
await db.exec(fs.readFileSync(R+'seed.sql','utf8'));
const U='11111111-1111-1111-1111-111111111111', A='22222222-2222-2222-2222-222222222222';
await db.exec(`insert into auth.users values ('${U}','u@x.com','{}'),('${A}','a@x.com','{"name":"Admin"}'); update public.profiles set role='admin' where id='${A}';`);
const as = async (uid, sql) => { await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false); select set_config('request.jwt.claim.role','authenticated',false);`); try { return await db.query(sql); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub','',false); select set_config('request.jwt.claim.role','',false);`); } };
let failed = 0;
const t = async (name, fn) => { try { const r = await fn(); console.log('OK  ', name, r ?? ''); } catch(e){ failed++; console.log('FAIL', name, e.message); } };
// Debe fallar: si la base de datos lo permite, es un agujero de seguridad
const blocked = async (name, fn) => { try { await fn(); failed++; console.log('FAIL', name, '(se permitió y no debería)'); } catch(e){ console.log('OK  ', name, '→ bloqueado:', e.message); } };
await t('counts', async()=> (await db.query('select (select count(*) from topics) t, (select count(*) from questions) q')).rows[0]);
await t('user reads questions', async()=> (await as(U,"select count(*) from questions")).rows[0]);
await db.exec("update questions set active=false where id='ang-signals-J1'");
await t('user cannot see hidden', async()=> (await as(U,"select count(*) from questions where id='ang-signals-J1'")).rows[0]);
await t('admin sees hidden', async()=> (await as(A,"select count(*) from questions where id='ang-signals-J1'")).rows[0]);
await t('user update question blocked (0 rows)', async()=> (await as(U,"update questions set prompt='x' where id='ang-signals-J2' returning id")).rows.length);
await t('admin update question', async()=> (await as(A,"update questions set prompt='editada' where id='ang-signals-J2' returning updated_by")).rows[0]);
await blocked('user self-promote blocked', async()=> (await as(U,"update profiles set role='admin' where id=auth.uid() returning role")).rows);
await blocked('user xp hack blocked', async()=> (await as(U,"update profiles set xp=9999 where id=auth.uid() returning xp")).rows);
await t('user onboarding', async()=> (await as(U,"update profiles set target_role='ANG', level='Mid', english='yes', onboarded=true where id=auth.uid() returning onboarded")).rows[0]);
await t('finish_lesson', async()=> { const r=(await as(U,"select * from finish_lesson('ang-signals','Mid',3,40)")).rows[0]; return {xp:r.xp,streak:r.streak,day_xp:r.day_xp}; });
await t('finish_lesson again same day', async()=> { const r=(await as(U,"select * from finish_lesson('ang-rxjs','Junior',2,500)")).rows[0]; return {xp:r.xp,streak:r.streak}; });
await t('progress visible', async()=> (await as(U,"select topic_id,best_stars from progress")).rows);
await t('report insert', async()=> (await as(U,"insert into reports (question_id, reason, comment) values ('ang-signals-J3','typo','falta tilde') returning id, status")).rows[0]);
await blocked('report forge status blocked', async()=> (await as(U,"insert into reports (question_id, reason, status) values ('ang-signals-J3','typo','resolved') returning id")).rows);
await t('user cannot resolve report', async()=> (await as(U,"update reports set status='resolved' returning id")).rows.length);
await t('admin resolves', async()=> (await as(A,"update reports set status='resolved', resolved_at=now() returning status")).rows[0]);
await t('other user cannot see report', async()=> { await db.exec(`insert into auth.users values ('33333333-3333-3333-3333-333333333333','b@x.com','{}')`); return (await as('33333333-3333-3333-3333-333333333333',"select count(*) from reports")).rows[0]; });
await t('wrong answers own', async()=> (await as(U,"insert into wrong_answers (question_id) values ('ang-signals-J3') returning user_id")).rows[0]);
await t('old content pruned', async()=> (await db.query("select (select count(*) from topics where id='ANG-01') t, (select count(*) from questions where id='ANG-01-J1') q")).rows[0]);
await t('code questions loaded', async()=> (await db.query("select count(*) from questions where code is not null")).rows[0]);
await blocked('open type rejected', async()=> (await db.query("insert into questions (id, topic_id, level, type, prompt) values ('x','ang-signals','Mid','open','x')")).rows);
await t('shared blocks', async()=> (await db.query("select role, count(*) from topics group by role order by role")).rows);
await t('spanish variant loaded', async()=> (await as(U,"select es_prompt, array_length(es_wrong,1) n from questions where id='com-dificiles-M2'")).rows[0]);
await t('delete my account', async()=> { await as(U,"select delete_my_account()"); return (await db.query(`select count(*) from profiles where id='${U}'`)).rows[0]; });
console.log(failed ? `\n${failed} comprobaciones fallidas` : '\nTodas las comprobaciones pasan');
process.exit(failed ? 1 : 0);
