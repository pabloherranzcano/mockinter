import { describe, expect, it } from 'vitest';
import { nextStep, topicComplete, topicSteps } from './progress';

describe('escalones por tema', () => {
  it('un Mid empieza en Mid, con Junior abierto y Senior cerrado', () => {
    const steps = topicSteps({}, 'Mid');
    expect(steps.map((s) => s.unlocked)).toEqual([true, true, false]);
    expect(nextStep(steps, 'Mid').level).toBe('Mid');
  });

  it('completar Mid abre Senior y pasa a ser el siguiente', () => {
    const steps = topicSteps({ Mid: 2 }, 'Mid');
    expect(steps[2].unlocked).toBe(true);
    expect(nextStep(steps, 'Mid').level).toBe('Senior');
    expect(topicComplete(steps, 'Mid')).toBe(false);
  });

  it('un Junior tiene que ir escalón a escalón', () => {
    expect(topicSteps({}, 'Junior').map((s) => s.unlocked)).toEqual([true, false, false]);
    expect(topicSteps({ Junior: 1 }, 'Junior').map((s) => s.unlocked)).toEqual([true, true, false]);
  });

  it('el tema está completo al hacer todos los escalones desde el de inicio', () => {
    const steps = topicSteps({ Mid: 3, Senior: 1 }, 'Mid');
    expect(topicComplete(steps, 'Mid')).toBe(true);
    expect(nextStep(steps, 'Mid').level).toBe('Senior');
  });
});
