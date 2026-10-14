import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Rich } from './Rich';
import { validateQuestion } from '../admin/QuestionEditor';
import { groupReports } from '../admin/AdminReports';
import { localizeQuestion } from '../lib/localize';
import { tokenize } from './CodeBlock';
import type { Question, Report } from '../lib/models';

describe('Rich', () => {
  it('convierte el texto entre comillas invertidas en <code>', () => {
    const { container } = render(<Rich text="Usa `@for` con `track`." />);
    expect([...container.querySelectorAll('code')].map((c) => c.textContent)).toEqual(['@for', 'track']);
    expect(container.textContent).toBe('Usa @for con track.');
  });

  it('no interpreta HTML', () => {
    const { container } = render(<Rich text="<img src=x onerror=alert(1)>" />);
    expect(container.querySelector('img')).toBeNull();
  });
});

describe('validateQuestion', () => {
  const base: Question = {
    id: '', topic_id: 'ANG-01', level: 'Mid', type: 'mc', prompt: '¿Qué?', code: null, correct: 'Esto', wrong: ['Aquello'],
    explanation: '', say_en: null, say_es: null, status: 'reviewed', active: true,
  };
  it('acepta una pregunta completa', () => expect(validateQuestion(base, '')).toBeNull());
  it('exige tema', () => expect(validateQuestion({ ...base, topic_id: '' }, '')).toMatch(/tema/));
  it('exige el hueco en completar frase', () => expect(validateQuestion({ ...base, type: 'fill' }, '')).toMatch(/___/));
  it('exige al menos una incorrecta', () => expect(validateQuestion({ ...base, wrong: [' '] }, '')).toMatch(/incorrecta/));
  it('exige dos piezas al ordenar', () => expect(validateQuestion({ ...base, type: 'order' }, 'solo una')).toMatch(/dos piezas/));
});

describe('groupReports', () => {
  it('agrupa por pregunta y ordena por número de reportes', () => {
    const r = (id: number, qid: string): Report => ({
      id, question_id: qid, user_id: null, reason: 'typo', comment: null, status: 'open', admin_note: null,
      created_at: '2026-10-13T10:00:00Z', resolved_at: null, questions: null,
    });
    const groups = groupReports([r(1, 'A'), r(2, 'B'), r(3, 'B')]);
    expect(groups.map((g) => [g.questionId, g.reports.length])).toEqual([['B', 2], ['A', 1]]);
  });
});


describe('localizeQuestion', () => {
  const q: Question = {
    id: 'COM-02-M2', topic_id: 'COM-02', level: 'Mid', type: 'mc', prompt: '"Why did you leave?" ¿Qué respondes?', code: null,
    correct: 'I wanted more growth.', wrong: ['My manager was terrible.'], explanation: 'Explicación', say_en: 'I was on a project…', say_es: 'Estaba en un proyecto…',
    status: 'reviewed', active: true,
    es_prompt: '«¿Por qué dejaste tu último trabajo?»', es_correct: 'Quería crecer.', es_wrong: ['Mi jefe era horrible.'], es_explanation: null,
  };
  it('en inglés no cambia nada', () => expect(localizeQuestion(q, 'en')).toBe(q));
  it('en español usa la variante y la frase de ejemplo traducida', () => {
    const es = localizeQuestion(q, 'es');
    expect(es.prompt).toBe('«¿Por qué dejaste tu último trabajo?»');
    expect(es.correct).toBe('Quería crecer.');
    expect(es.wrong).toEqual(['Mi jefe era horrible.']);
    expect(es.explanation).toBe('Explicación');
    expect(es.say_en).toBe('Estaba en un proyecto…');
    expect(es.say_es).toBeNull();
  });
  it('sin variante, en español deja la pregunta como estaba', () => {
    const plain = { ...q, es_prompt: null, es_correct: null, es_wrong: null };
    expect(localizeQuestion(plain, 'es').prompt).toBe(q.prompt);
  });
});


describe('CodeBlock', () => {
  it('resalta palabras clave, cadenas y comentarios sin perder texto', () => {
    const code = "const a = 'hola'; // saludo\nreturn a;";
    const parts = tokenize(code);
    expect(parts.map((p) => p.t).join('')).toBe(code);
    expect(parts.find((p) => p.t === 'const')?.c).toBe('kw');
    expect(parts.find((p) => p.t === "'hola'")?.c).toBe('str');
    expect(parts.find((p) => p.t.startsWith('//'))?.c).toBe('com');
  });
});
