import { supabase } from './supabase';
import { shuffle } from './utils';
import type { Grade, Level, Profile, Question, Report, ReportReason, ReportStatus, Topic } from './models';

export interface PathTopic extends Topic { stars: number; }

// ---------- Usuario ----------

/** Temas del camino: presentación, los del puesto, preguntas difíciles y (si aplica) inglés. */
export async function fetchPathTopics(p: Profile): Promise<PathTopic[]> {
  const [{ data: topics, error }, { data: prog }] = await Promise.all([
    supabase.from('topics').select('*').in('role', [p.target_role, 'COM']).eq('active', true),
    supabase.from('progress').select('topic_id, best_stars').eq('level', p.level),
  ]);
  if (error) throw error;
  const stars = new Map((prog ?? []).map((r) => [r.topic_id as string, r.best_stars as number]));
  const all = (topics as Topic[]).filter((t) => !(t.is_english && p.english === 'no'));
  const common = all.filter((t) => t.role === 'COM').sort((a, b) => a.position - b.position);
  const own = all.filter((t) => t.role !== 'COM').sort((a, b) => a.position - b.position);
  return [...common.slice(0, 1), ...own, ...common.slice(1)].map((t) => ({ ...t, stars: stars.get(t.id) ?? 0 }));
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

export async function fetchReviewQuestions(limit = 8): Promise<Question[]> {
  const { data, error } = await supabase.from('wrong_answers')
    .select('question_id, questions(*)').order('created_at', { ascending: false }).limit(40);
  if (error) throw error;
  const qs = (data ?? [])
    .map((r) => (r as unknown as { questions: Question | null }).questions)
    .filter((q): q is Question => !!q && q.active && q.type !== 'open');
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

/** Devuelve la corrección o un código de error ('daily_limit', 'ai_unavailable'...). */
export async function gradeAnswer(questionId: string, answer: string, lang: 'en' | 'es'): Promise<Grade | { error: string }> {
  const { data, error } = await supabase.functions.invoke('grade', { body: { questionId, answer, lang } });
  if (error) {
    try {
      const body = await (error as { context?: Response }).context?.json();
      return { error: body?.error ?? 'ai_unavailable' };
    } catch { return { error: 'ai_unavailable' }; }
  }
  return data as Grade;
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
