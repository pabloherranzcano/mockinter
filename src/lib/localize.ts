import type { Question } from './models';

/**
 * Adapta una pregunta al idioma de la entrevista.
 * En español usa la variante española si existe, y muestra la frase de ejemplo ya traducida.
 * En inglés devuelve la pregunta tal cual.
 */
export function localizeQuestion(q: Question, lang: 'en' | 'es'): Question {
  if (lang === 'en') return q;
  return {
    ...q,
    prompt: q.es_prompt || q.prompt,
    correct: q.es_correct || q.correct,
    wrong: q.es_wrong?.length ? q.es_wrong : q.wrong,
    explanation: q.es_explanation || q.explanation,
    // La frase "para decir en la entrevista" pasa a ser la versión en español, sin traducción debajo
    say_en: q.say_en ? (q.say_es || q.say_en) : null,
    say_es: null,
  };
}
