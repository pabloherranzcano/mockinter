import { supabase } from './supabase';
import { shuffle } from './utils';
import { SHARED_BLOCKS, type Level, type Profile, type Question, type Report, type ReportReason, type ReportStatus, type Topic } from './models';
import type { LevelStars } from './progress';

export interface PathTopic extends Topic {
  /** Estrellas por escalón (nivel) del tema. */
  stars: LevelStars;
}

/**
 * Temas del camino según el puesto: presentación, los del puesto, los bloques compartidos
 * (frontend, desarrollo), preguntas difíciles y, si la entrevista es en inglés, el bloque de inglés.
 */
export async function fetchPathTopics(p: Profile): Promise<PathTopic[]> {
  const role = p.target_role ?? '';
  const shared = SHARED_BLOCKS[role] ?? [];
  const [{ data: topics, error }, { data: prog }] = await Promise.all([
    supabase.from('topics').select('*').in('role', [role, ...shared, 'COM']).eq('active', true),
    supabase.from('progress').select('topic_id, level, best_stars'),
  ]);
  if (error) throw error;
  const stars = new Map<string, LevelStars>();
  for (const r of prog ?? []) {
    const m = stars.get(r.topic_id) ?? {};
    m[r.level as Level] = r.best_stars as number;
    stars.set(r.topic_id, m);
  }
  const all = (topics as Topic[]).filter((t) => !(t.is_english && p.english === 'no'));
  const byPos = (a: Topic, b: Topic) => a.position - b.position;
  const block = (code: string) => all.filter((t) => t.role === code).sort(byPos);
  const common = block('COM');
  const ordered = [common[0], ...block(role), ...shared.flatMap(block), ...common.slice(1)].filter(Boolean);
  return ordered.map((t) => ({ ...t, stars: stars.get(t.id) ?? {} }));
}

export async function fetchTopic(id: string): Promise<Topic | null> {
  const { data } = await supabase.from('topics').select('*').eq('id', id).maybeSingle();
  return data as Topic | null;
}

export async function fetchLessonQuestions(topicId: string, level: Level): Promise<Question[]> {
  const { data, error } = await supabase.from('questions').select('*')
    .eq('topic_id', topicId).eq('level', level).eq('active', true).neq('status', 'discarded').order('id');
  if (error) throw error;
  return data as Question[];
}

/** Preguntas falladas para repasar. Con entrevista en español se excluye el bloque de inglés. */
export async function fetchReviewQuestions(lang: 'en' | 'es', limit = 8): Promise<Question[]> {
  const { data, error } = await supabase.from('wrong_answers')
    .select('question_id, questions(*, topics(is_english))').order('created_at', { ascending: false }).limit(40);
  if (error) throw error;
  type Row = { questions: (Question & { topics?: { is_english: boolean } | null }) | null };
  const qs = (data ?? [])
    .map((r) => (r as unknown as Row).questions)
    .filter((q): q is Question & { topics?: { is_english: boolean } | null } =>
      !!q && q.active && !(lang === 'es' && q.topics?.is_english))
    .map(({ topics: _t, ...q }) => q as Question);
  return shuffle(qs).slice(0, limit);
}

export async function fetchWrongCount(): Promise<number> {
  const { count } = await supabase.from('wrong_answers').select('question_id', { count: 'exact', head: true });
  return count ?? 0;
}

export async function markWrong(userId: string, questionId: string) {
  await supabase.from('wrong_answers').upsert({ user_id: userId, question_id: questionId }, { ignoreDuplicates: true });
}

export async function clearWrong(questionId: string) {
  await supabase.from('wrong_answers').delete().eq('question_id', questionId);
}

export async function finishLesson(topicId: string | null, level: Level | null, stars: number, xp: number): Promise<Profile> {
  const { data, error } = await supabase.rpc('finish_lesson', { p_topic: topicId, p_level: level, p_stars: stars, p_xp: xp });
  if (error) throw error;
  return data as Profile;
}

export async function sendReport(userId: string, questionId: string, reason: ReportReason, comment: string) {
  const { error } = await supabase.from('reports').insert({
    question_id: questionId, reason, comment: comment.trim() || null, user_id: userId,
  });
  if (error) throw error;
}

// ---------- Admin ----------

export async function fetchAllTopics(): Promise<Topic[]> {
  const { data, error } = await supabase.from('topics').select('*').order('role').order('position');
  if (error) throw error;
  return data as Topic[];
}

export async function fetchAdminQuestions(): Promise<Question[]> {
  const { data, error } = await supabase.from('questions').select('*').order('id').limit(5000);
  if (error) throw error;
  return data as Question[];
}

export async function fetchQuestion(id: string): Promise<Question | null> {
  const { data } = await supabase.from('questions').select('*').eq('id', id).maybeSingle();
  return data as Question | null;
}

export async function saveQuestion(q: Question, isNew: boolean): Promise<Question> {
  const { updated_at: _ignored, ...row } = q;
  const res = isNew
    ? await supabase.from('questions').insert(row).select('*').single()
    : await supabase.from('questions').update(row).eq('id', q.id).select('*').single();
  if (res.error) throw res.error;
  return res.data as Question;
}

export async function setQuestionActive(id: string, active: boolean) {
  const { error } = await supabase.from('questions').update({ active }).eq('id', id);
  if (error) throw error;
}

export async function nextQuestionId(topicId: string, level: Level): Promise<string> {
  const prefix = `${topicId}-${level[0]}`;
  const { data } = await supabase.from('questions').select('id').like('id', `${prefix}%`);
  const nums = (data ?? []).map((r) => Number(String(r.id).slice(prefix.length)) || 0);
  return `${prefix}${Math.max(0, ...nums) + 1}`;
}

export async function fetchReports(status: ReportStatus | 'all' = 'open'): Promise<Report[]> {
  let q = supabase.from('reports')
    .select('*, questions(id, prompt, type, level, topic_id, active)')
    .order('created_at', { ascending: false }).limit(500);
  if (status !== 'all') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data as Report[];
}

export async function fetchOpenReportCounts(): Promise<Map<string, number>> {
  const { data } = await supabase.from('reports').select('question_id').eq('status', 'open');
  const m = new Map<string, number>();
  for (const r of data ?? []) m.set(r.question_id, (m.get(r.question_id) ?? 0) + 1);
  return m;
}

export async function setReportStatus(ids: number[], status: ReportStatus) {
  const { error } = await supabase.from('reports').update({
    status, resolved_at: status === 'open' ? null : new Date().toISOString(),
  }).in('id', ids);
  if (error) throw error;
}
