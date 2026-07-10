import { describe, it, expect } from 'vitest';
import { generateBrewIntent } from '../engine/brew-intent';

describe('generateBrewIntent', () => {
  it('returns all intent fields', () => {
    const intent = generateBrewIntent({ process: 'washed', roastLevel: 'light', tastingNotes: ['floral'] }, 'balanced');
    expect(intent).toHaveProperty('clarityPriority');
    expect(intent).toHaveProperty('sweetnessPriority');
    expect(intent).toHaveProperty('bodyPriority');
    expect(intent).toHaveProperty('competitionStyle');
    expect(intent).toHaveProperty('premiumCoffee');
    expect(intent).toHaveProperty('gentleExtraction');
    expect(intent).toHaveProperty('highExtraction');
    expect(intent).toHaveProperty('lowAgitation');
    expect(intent).toHaveProperty('highAgitation');
    expect(intent).toHaveProperty('fruitForward');
    expect(intent).toHaveProperty('comfortCup');
    expect(intent).toHaveProperty('experimental');
  });

  it('values are in valid ranges', () => {
    const intent = generateBrewIntent({}, 'balanced');
    expect(intent.clarityPriority).toBeGreaterThanOrEqual(1);
    expect(intent.clarityPriority).toBeLessThanOrEqual(10);
    expect(intent.sweetnessPriority).toBeGreaterThanOrEqual(1);
    expect(intent.bodyPriority).toBeGreaterThanOrEqual(1);
  });

  it('fruitForward is true for natural process with fruity notes', () => {
    const intent = generateBrewIntent({ process: 'natural', tastingNotes: ['berry', 'fruit'] }, 'balanced');
    expect(intent.fruitForward).toBe(true);
  });

  it('acidity focus increases clarity priority', () => {
    const balanced = generateBrewIntent({ process: 'washed' }, 'balanced');
    const acidic = generateBrewIntent({ process: 'washed' }, 'brighter_acidity');
    expect(acidic.clarityPriority).toBeGreaterThanOrEqual(balanced.clarityPriority);
  });

  it('sweetness focus increases sweetness and body priority', () => {
    const balanced = generateBrewIntent({ process: 'washed' }, 'balanced');
    const sweet = generateBrewIntent({ process: 'washed' }, 'more_sweetness_body');
    expect(sweet.sweetnessPriority).toBeGreaterThanOrEqual(balanced.sweetnessPriority);
    expect(sweet.bodyPriority).toBeGreaterThanOrEqual(balanced.bodyPriority);
  });

  it('handles empty input gracefully', () => {
    const intent = generateBrewIntent({}, 'balanced');
    expect(typeof intent.clarityPriority).toBe('number');
    expect(typeof intent.competitionStyle).toBe('boolean');
  });
});
