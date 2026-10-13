import { Injectable, inject } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { AuthService } from './auth.service';
import { Grade, Level, Profile, Question, Report, ReportReason, ReportStatus, Topic } from './models';

export interface PathTopic extends Topic { stars: number; }

@Injectable({ providedIn: 'root' })
export class ContentService {
  private sb = inject(SupabaseService).client;
  private auth = inject(AuthService);

  // ---------- Usuario ----------

  /** Temas del camino: presentación, los del puesto, preguntas difíciles y (si aplica) inglés. */
  async pathTopics(p: Profile): Promise<PathTopic[]> {
    const [{ data: topics, error }, { data: prog }] = await Promise.all([
      this.sb.from('topics').select('*').in('role', [p.target_role, 'COM']).eq('active', true),
      this.sb.from('progress').select('topic_id, best_stars').eq('level', p.level),
    ]);
    if (error) throw error;
    const stars = new Map((prog ?? []).map((r) => [r.topic_id as string, r.best_stars as number]));
    const all = (topics as Topic[]).filter((t) => !(t.is_english && p.english === 'no'));
    const common = all.filter((t) => t.role === 'COM').sort((a, b) => a.position - b.position);
    const own = all.filter((t) => t.role !== 'COM').sort((a, b) => a.position - b.position);
    const ordered = [...common.slice(0, 1), ...own, ...common.slice(1)];
    return ordered.map((t) => ({ ...t, stars: stars.get(t.id) ?? 0 }));
  }

  async topic(id: string): Promise<Topic | null> {
    const { data } = await this.sb.from('topics').select('*').eq('id', id).maybeSingle();
    return data as Topic | null;
  }

  async lessonQuestions(topicId: string, level: Level): Promise<Question[]> {
    const { data, error } = await this.sb.from('questions').select('*')
      .eq('topic_id', topicId).eq('level', level).eq('active', true).neq('status', 'discarded').order('id');
    if (error) throw error;
    return data as Question[];
  }

  async reviewQuestions(limit = 8): Promise<Question[]> {
    const { data, error } = await this.sb.from('wrong_answers')
      .select('question_id, questions(*)').order('created_at', { ascending: false }).limit(40);
    if (error) throw error;
    const qs = (data ?? []).map((r: any) => r.questions as Question).filter((q) => q && q.active && q.type !== 'open');
    return shuffle(qs).slice(0, limit);
  }

  async wrongCount(): Promise<number> {
    const { count } = await this.sb.from('wrong_answers').select('question_id', { count: 'exact', head: true });
    return count ?? 0;
  }

  async markWrong(questionId: string) {
    const uid = this.auth.session()?.user.id;
    if (!uid) return;
    await this.sb.from('wrong_answers').upsert({ user_id: uid, question_id: questionId }, { ignoreDuplicates: true });
  }

  async clearWrong(questionId: string) {
    await this.sb.from('wrong_answers').delete().eq('question_id', questionId);
  }

  async finishLesson(topicId: string | null, level: Level | null, stars: number, xp: number) {
    const { data, error } = await this.sb.rpc('finish_lesson', {
      p_topic: topicId, p_level: level, p_stars: stars, p_xp: xp,
    });
    if (error) throw error;
    this.auth.profile.set(data as Profile);
  }

  async report(questionId: string, reason: ReportReason, comment: string) {
    const { error } = await this.sb.from('reports').insert({
      question_id: questionId, reason, comment: comment.trim() || null,
      user_id: this.auth.session()?.user.id,
    });
    if (error) throw error;
  }

  /** Devuelve la corrección o un código de error ('daily_limit', 'ai_unavailable'...). */
  async grade(questionId: string, answer: string, lang: 'en' | 'es'): Promise<Grade | { error: string }> {
    const { data, error } = await this.sb.functions.invoke('grade', { body: { questionId, answer, lang } });
    if (error) {
      try {
        const body = await (error as any).context?.json?.();
        return { error: body?.error ?? 'ai_unavailable' };
      } catch { return { error: 'ai_unavailable' }; }
    }
    return data as Grade;
  }

  // ---------- Admin ----------

  async allTopics(): Promise<Topic[]> {
    const { data, error } = await this.sb.from('topics').select('*').order('role').order('position');
    if (error) throw error;
    return data as Topic[];
  }

  async adminQuestions(): Promise<Question[]> {
    const { data, error } = await this.sb.from('questions').select('*').order('id').limit(5000);
    if (error) throw error;
    return data as Question[];
  }

  async question(id: string): Promise<Question | null> {
    const { data } = await this.sb.from('questions').select('*').eq('id', id).maybeSingle();
    return data as Question | null;
  }

  async saveQuestion(q: Question, isNew: boolean) {
    const { updated_at, ...row } = q;
    const res = isNew
      ? await this.sb.from('questions').insert(row).select('*').single()
      : await this.sb.from('questions').update(row).eq('id', q.id).select('*').single();
    if (res.error) throw res.error;
    return res.data as Question;
  }

  async setActive(id: string, active: boolean) {
    const { error } = await this.sb.from('questions').update({ active }).eq('id', id);
    if (error) throw error;
  }

  async nextQuestionId(topicId: string, level: Level): Promise<string> {
    const prefix = `${topicId}-${level[0]}`;
    const { data } = await this.sb.from('questions').select('id').like('id', `${prefix}%`);
    const nums = (data ?? []).map((r) => Number(String(r.id).slice(prefix.length)) || 0);
    return `${prefix}${Math.max(0, ...nums) + 1}`;
  }

  async reports(status: ReportStatus | 'all' = 'open'): Promise<Report[]> {
    let q = this.sb.from('reports')
      .select('*, questions(id, prompt, type, level, topic_id, active)')
      .order('created_at', { ascending: false }).limit(500);
    if (status !== 'all') q = q.eq('status', status);
    const { data, error } = await q;
    if (error) throw error;
    return data as Report[];
  }

  async openReportCounts(): Promise<Map<string, number>> {
    const { data } = await this.sb.from('reports').select('question_id').eq('status', 'open');
    const m = new Map<string, number>();
    for (const r of data ?? []) m.set(r.question_id, (m.get(r.question_id) ?? 0) + 1);
    return m;
  }

  async setReportStatus(ids: number[], status: ReportStatus, note?: string) {
    const { error } = await this.sb.from('reports').update({
      status, admin_note: note ?? null, resolved_at: status === 'open' ? null : new Date().toISOString(),
    }).in('id', ids);
    if (error) throw error;
  }
}

export function shuffle<T>(a: T[]): T[] {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function todayMadrid(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}
export function yesterdayMadrid(): string {
  const d = new Date(Date.now() - 864e5);
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}
