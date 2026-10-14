import type { Level } from './models';

/**
 * Lógica de escalones dentro de cada tema (sin React ni red, para poder testearla).
 *
 * - Cada tema tiene tres escalones: Junior, Mid y Senior.
 * - El nivel del onboarding (start) marca dónde empieza el usuario: ese escalón y los anteriores están abiertos.
 * - Los escalones por encima se abren al completar el anterior.
 */

export const LEVEL_ORDER: Level[] = ['Junior', 'Mid', 'Senior'];

export type LevelStars = Partial<Record<Level, number>>;

export interface StepState {
  level: Level;
  stars: number;
  done: boolean;
  unlocked: boolean;
}

export function topicSteps(stars: LevelStars, start: Level): StepState[] {
  const startIdx = LEVEL_ORDER.indexOf(start);
  return LEVEL_ORDER.map((level, i) => {
    const s = stars[level] ?? 0;
    const prevDone = i > 0 && (stars[LEVEL_ORDER[i - 1]] ?? 0) > 0;
    return { level, stars: s, done: s > 0, unlocked: i <= startIdx || prevDone };
  });
}

/** Escalón que toca practicar: el primero abierto y sin hacer desde el nivel de inicio. Si todo está hecho, el más alto. */
export function nextStep(steps: StepState[], start: Level): StepState {
  const startIdx = LEVEL_ORDER.indexOf(start);
  return steps.slice(startIdx).find((s) => s.unlocked && !s.done) ?? steps[steps.length - 1];
}

/** Un tema está completo cuando están hechos todos los escalones desde el nivel de inicio hasta Senior. */
export function topicComplete(steps: StepState[], start: Level): boolean {
  return steps.slice(LEVEL_ORDER.indexOf(start)).every((s) => s.done);
}

/** Iniciales para mostrar el escalón en poco espacio. */
export const LEVEL_SHORT: Record<Level, string> = { Junior: 'J', Mid: 'M', Senior: 'S' };
