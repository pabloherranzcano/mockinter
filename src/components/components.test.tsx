import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Rich } from './Rich';
import { validateQuestion } from '../admin/QuestionEditor';
import { groupReports } from '../admin/AdminReports';
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
    id: '', topic_id: 'ANG-01', level: 'Mid', type: 'mc', prompt: '¿Qué?', prompt_en: null, correct: 'Esto', wrong: ['Aquello'],
    explanation: '', say_en: null, say_es: null, keys: null, model_en: null, model_es: null, status: 'reviewed', active: true,
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
