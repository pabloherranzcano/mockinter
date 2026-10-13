import type { Question } from '../lib/models';
import { shuffle } from '../lib/utils';

/**
 * Lógica de una lección como reducer puro (sin React ni red), para poder testearla aislada.
 * La pantalla solo despacha acciones y pinta el estado.
 */

export const HEARTS = 5;
export const PASS_SCORE = 55;

export interface Option { text: string; correct: boolean; }

export interface Feedback {
  kind: 'ok' | 'bad' | 'open';
  title: string;
  solution?: string;
  why?: string | null;
  say?: { label: string; en: string; es: string | null } | null;
  xp?: number;
  /** Acertada a la primera (para quitarla de la lista de fallos). */
  firstTry?: boolean;
}

export interface LessonState {
  phase: 'play' | 'dead' | 'result';
  queue: Question[];
  total: number;
  closedCount: number;
  done: number;
  hearts: number;
  xp: number;
  seen: string[];
  /** La pregunta actual se falló y debe volver al final de la cola al continuar. */
  requeue: boolean;
  // estado de la pregunta actual
  options: Option[];
  selected: number | null;
  orderItems: string[];
  bank: number[];
  placed: number[];
  feedback: Feedback | null;
}

export type LessonAction =
  | { type: 'select'; index: number }
  | { type: 'place'; index: number }
  | { type: 'unplace'; position: number }
  | { type: 'check' }
  | { type: 'openResult'; pass: boolean; xp: number; title: string }
  | { type: 'next' };

const titlesOk = ['¡Correcto!', '¡Eso es!', '¡Muy bien!'];

function prepare(q: Question | undefined): Pick<LessonState, 'options' | 'selected' | 'orderItems' | 'bank' | 'placed' | 'feedback'> {
  const base = { options: [], selected: null, orderItems: [], bank: [], placed: [], feedback: null };
  if (!q) return base;
  if (q.type === 'mc' || q.type === 'fill') {
    return { ...base, options: shuffle([{ text: q.correct ?? '', correct: true }, ...q.wrong.filter(Boolean).map((w) => ({ text: w, correct: false }))]) };
  }
  if (q.type === 'order') {
    const items = (q.correct ?? '').split(' | ').map((s) => s.trim()).filter(Boolean);
    let bank = shuffle(items.map((_, i) => i));
    if (items.length > 1 && bank.every((v, i) => v === i)) bank = bank.reverse();
    return { ...base, orderItems: items, bank };
  }
  return base;
}

/** Cerradas barajadas primero, la abierta al final. */
export function initLesson(questions: Question[]): LessonState {
  const closed = shuffle(questions.filter((q) => q.type !== 'open'));
  const open = questions.filter((q) => q.type === 'open');
  const queue = [...closed, ...open];
  return {
    phase: 'play', queue, total: queue.length, closedCount: closed.length, done: 0, hearts: HEARTS, xp: 0,
    seen: [], requeue: false, ...prepare(queue[0]),
  };
}

export function canCheck(s: LessonState): boolean {
  const q = s.queue[0];
  if (!q || s.feedback) return false;
  if (q.type === 'order') return s.placed.length === s.orderItems.length && s.orderItems.length > 0;
  return s.selected !== null;
}

export function lessonReducer(s: LessonState, a: LessonAction): LessonState {
  const q = s.queue[0];
  switch (a.type) {
    case 'select':
      return s.feedback ? s : { ...s, selected: a.index };
    case 'place':
      return s.feedback || s.placed.includes(a.index) ? s : { ...s, placed: [...s.placed, a.index] };
    case 'unplace':
      return s.feedback ? s : { ...s, placed: s.placed.filter((_, i) => i !== a.position) };
    case 'check': {
      if (!q || !canCheck(s)) return s;
      let ok: boolean, solution: string;
      if (q.type === 'order') {
        ok = s.placed.every((v, i) => v === i);
        solution = 'Orden correcto: ' + s.orderItems.map((t, i) => `${i + 1}. ${t}`).join('  ');
      } else {
        ok = s.options[s.selected!]?.correct ?? false;
        solution = q.type === 'fill' ? q.prompt.replace('___', q.correct ?? '') : (q.correct ?? '');
      }
      const first = !s.seen.includes(q.id);
      const say = q.say_en ? { label: ok ? 'Ejemplo de lo que podrías decir' : 'Lo que deberías decir', en: q.say_en, es: q.say_es } : null;
      const seen = first ? [...s.seen, q.id] : s.seen;
      if (ok) {
        return {
          ...s, seen, done: s.done + 1, xp: s.xp + 10, requeue: false,
          feedback: { kind: 'ok', title: titlesOk[s.done % titlesOk.length], why: q.explanation, say, firstTry: first },
        };
      }
      return {
        ...s, seen, hearts: s.hearts - 1, requeue: true,
        feedback: { kind: 'bad', title: 'No exactamente', solution, why: q.explanation, say },
      };
    }
    case 'openResult':
      return { ...s, done: s.done + 1, xp: s.xp + a.xp, requeue: false, feedback: { kind: 'open', title: a.title, xp: a.xp } };
    case 'next': {
      if (!q || !s.feedback) return s;
      const queue = s.requeue ? [...s.queue.slice(1), q] : s.queue.slice(1);
      if (s.hearts <= 0) return { ...s, phase: 'dead', requeue: false };
      if (!queue.length) return { ...s, queue, phase: 'result', requeue: false };
      return { ...s, queue, requeue: false, ...prepare(queue[0]) };
    }
  }
}

/** Estrellas al terminar: 3 sin fallos, 2 con uno o dos, 1 con más. */
export function starsFor(s: LessonState): number {
  const mistakes = HEARTS - s.hearts;
  return mistakes === 0 ? 3 : mistakes <= 2 ? 2 : 1;
}

export function accuracy(s: LessonState): number {
  const n = s.closedCount;
  return n ? Math.round((100 * Math.max(0, n - (HEARTS - s.hearts))) / n) : 100;
}
