import { describe, expect, it } from 'vitest';
import type { Question } from '../lib/models';
import { HEARTS, accuracy, canCheck, initLesson, lessonReducer, starsFor, type LessonState } from './lessonReducer';

function q(id: string, type: Question['type'], extra: Partial<Question> = {}): Question {
  return {
    id, topic_id: 'ang-signals', level: 'Mid', type, prompt: 'Pregunta ___', code: null, correct: 'Bien', wrong: ['Mal 1', 'Mal 2'],
    explanation: 'Porque sí', say_en: null, say_es: null, status: 'reviewed', active: true, ...extra,
  };
}

const pick = (s: LessonState, correct: boolean) => s.options.findIndex((o) => o.correct === correct);
const answer = (s: LessonState, correct: boolean) =>
  lessonReducer(lessonReducer(s, { type: 'select', index: pick(s, correct) }), { type: 'check' });

describe('lessonReducer', () => {
  it('incluye todas las preguntas, barajadas', () => {
    const s = initLesson([q('a', 'mc'), q('b', 'fill'), q('c', 'order', { correct: 'x | y' })]);
    expect(s.queue.map((x) => x.id).sort()).toEqual(['a', 'b', 'c']);
    expect(s.total).toBe(3);
  });

  it('un acierto suma 10 XP y avanza', () => {
    let s = initLesson([q('a', 'mc'), q('b', 'mc')]);
    expect(canCheck(s)).toBe(false);
    s = answer(s, true);
    expect(s.feedback?.kind).toBe('ok');
    expect(s.feedback?.firstTry).toBe(true);
    expect(s.xp).toBe(10);
    s = lessonReducer(s, { type: 'next' });
    expect(s.queue).toHaveLength(1);
    expect(s.feedback).toBeNull();
  });

  it('un fallo quita una vida y la pregunta vuelve al final de la cola', () => {
    let s = initLesson([q('a', 'mc'), q('b', 'mc')]);
    const first = s.queue[0].id;
    s = answer(s, false);
    expect(s.hearts).toBe(HEARTS - 1);
    expect(s.feedback?.kind).toBe('bad');
    expect(s.feedback?.solution).toBe('Bien');
    s = lessonReducer(s, { type: 'next' });
    expect(s.queue.map((x) => x.id)).toEqual([first === 'a' ? 'b' : 'a', first]);
  });

  it('sin vidas termina la lección', () => {
    let s = initLesson([q('a', 'mc')]);
    for (let i = 0; i < HEARTS; i++) s = lessonReducer(answer(s, false), { type: 'next' });
    expect(s.phase).toBe('dead');
  });

  it('ordenar: solo es correcto en el orden exacto', () => {
    let s = initLesson([q('a', 'order', { correct: 'Uno | Dos | Tres' })]);
    expect(s.orderItems).toEqual(['Uno', 'Dos', 'Tres']);
    expect(s.bank).not.toEqual([0, 1, 2]);
    for (const i of [0, 2, 1]) s = lessonReducer(s, { type: 'place', index: i });
    s = lessonReducer(s, { type: 'unplace', position: 1 });
    s = lessonReducer(s, { type: 'place', index: 1 });
    s = lessonReducer(s, { type: 'place', index: 2 });
    expect(s.placed).toEqual([0, 1, 2]);
    s = lessonReducer(s, { type: 'check' });
    expect(s.feedback?.kind).toBe('ok');
  });

  it('completar frase: la solución muestra la frase entera', () => {
    let s = initLesson([q('a', 'fill', { prompt: 'Se usa ___ aquí.', correct: 'track' })]);
    s = answer(s, false);
    expect(s.feedback?.solution).toBe('Se usa track aquí.');
  });

  it('la frase de ejemplo cambia de título según aciertes o falles', () => {
    const base = q('a', 'mc', { say_en: 'Say this', say_es: 'Di esto' });
    expect(answer(initLesson([base]), true).feedback?.say?.label).toBe('Ejemplo de lo que podrías decir');
    expect(answer(initLesson([base]), false).feedback?.say?.label).toBe('Lo que deberías decir');
  });

  it('calcula estrellas y acierto', () => {
    let s = initLesson([q('a', 'mc'), q('b', 'mc'), q('c', 'mc'), q('d', 'mc')]);
    s = lessonReducer(answer(s, false), { type: 'next' });
    expect(starsFor(s)).toBe(2);
    expect(accuracy(s)).toBe(75);
  });

  it('termina al responder bien la última pregunta', () => {
    let s = initLesson([q('a', 'mc')]);
    s = lessonReducer(answer(s, true), { type: 'next' });
    expect(s.phase).toBe('result');
  });
});
