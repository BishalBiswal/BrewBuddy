import { describe, it, expect } from 'vitest';
import { validateRecipe, repairRecipe, generateFallbackSteps } from '../engine/recipe-validator';
import brewers from '../data/brewers.json';

function getBrewer(id) {
  return brewers.find(b => b.id === id);
}

describe('validateRecipe', () => {
  it('returns valid for a well-formed recipe', () => {
    const recipe = {
      ratio: 15,
      temperature: 94,
      total_time_seconds: 180,
      grind_relative: 'medium-fine',
      brew_steps: [
        { type: 'bloom', name: 'Bloom', start_time: 0, duration: 30, water: 0.2, pour_pattern: 'spiral', agitation: 'none', instruction: 'Bloom' },
        { type: 'pour', name: 'Main Pour', start_time: 30, duration: 90, water: 0.5, pour_pattern: 'spiral', agitation: 'none', instruction: 'Pour' },
        { type: 'pour', name: 'Final Pour', start_time: 120, duration: 45, water: 0.3, pour_pattern: 'center', agitation: 'none', instruction: 'Pour' },
      ],
    };
    const result = validateRecipe(recipe, 'v60');
    expect(result.valid).toBe(true);
  });

  it('rejects ratio outside range', () => {
    const result = validateRecipe({ ratio: 25, brew_steps: [{ type: 'pour' }] }, 'v60');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Ratio'))).toBe(true);
  });

  it('rejects temperature outside range', () => {
    const result = validateRecipe({ temperature: 50, brew_steps: [{ type: 'pour' }] }, 'v60');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Temperature'))).toBe(true);
  });

  it('rejects water fractions that do not sum to 1', () => {
    const recipe = {
      ratio: 15,
      brew_steps: [
        { type: 'bloom', water: 0.1 },
        { type: 'pour', water: 0.3 },
      ],
    };
    const result = validateRecipe(recipe, 'v60');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('water fractions'))).toBe(true);
  });

  it('rejects bloom on brewer that does not support it', () => {
    const recipe = {
      ratio: 14,
      brew_steps: [{ type: 'bloom', name: 'Bloom', water: 0.2 }, { type: 'pour', water: 0.8 }],
    };
    const result = validateRecipe(recipe, 'french_press');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('bloom'))).toBe(true);
  });

  it('rejects swirl on brewer that does not support it', () => {
    const recipe = {
      ratio: 15,
      brew_steps: [
        { type: 'pour', name: 'Pour', water: 1, agitation: 'gentle_swirl' },
      ],
    };
    const result = validateRecipe(recipe, 'moka_pot');
    expect(result.valid).toBe(false);
  });

  it('rejects empty brew_steps', () => {
    const result = validateRecipe({ ratio: 15, brew_steps: [] }, 'v60');
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('no brew steps') || e.includes('brew steps'))).toBe(true);
  });

  it('returns valid for espresso recipe', () => {
    const recipe = {
      ratio: 2.5,
      temperature: 93,
      total_time_seconds: 28,
      grind_relative: 'fine',
      brew_steps: [{ type: 'action', name: 'Brew', water: 1 }],
    };
    const result = validateRecipe(recipe, 'espresso');
    expect(result.valid).toBe(true);
  });
});

describe('repairRecipe', () => {
  it('returns recipe unchanged if valid', () => {
    const recipe = { ratio: 15, brew_steps: [{ type: 'pour', water: 1 }] };
    const validation = { valid: true, errors: [] };
    const repaired = repairRecipe(recipe, 'v60', validation);
    expect(repaired.ratio).toBe(15);
  });

  it('clamps ratio to range', () => {
    const recipe = { ratio: 50, brew_steps: [{ type: 'pour', water: 1 }] };
    const validation = validateRecipe(recipe, 'v60');
    const repaired = repairRecipe(recipe, 'v60', validation);
    expect(repaired.ratio).toBeLessThanOrEqual(18);
  });

  it('fixes water fraction sum to 1.0', () => {
    const recipe = { ratio: 15, brew_steps: [
      { type: 'bloom', water: 0.1 },
      { type: 'pour', water: 0.3 },
    ]};
    const validation = validateRecipe(recipe, 'v60');
    const repaired = repairRecipe(recipe, 'v60', validation);
    const waterSum = repaired.brew_steps
      .filter(s => s.type === 'pour' || s.type === 'bloom')
      .reduce((sum, s) => sum + s.water, 0);
    expect(waterSum).toBeCloseTo(1.0, 1);
  });

  it('removes spiral pour pattern if brewer does not support it', () => {
    const brewer = getBrewer('moka_pot');
    if (!brewer || brewer.constraints.supports_spiral) return;
    const recipe = { ratio: 10, brew_steps: [{ type: 'pour', water: 1, pour_pattern: 'spiral', name: 'Test' }] };
    const validation = validateRecipe(recipe, 'moka_pot');
    const repaired = repairRecipe(recipe, 'moka_pot', validation);
    expect(repaired.brew_steps[0].pour_pattern).not.toBe('spiral');
  });
});

describe('generateFallbackSteps', () => {
  it('generates bloom step for pour-over brewers', () => {
    const v60 = getBrewer('v60');
    const steps = generateFallbackSteps(v60, 15, 16.7, 250);
    expect(steps.length).toBeGreaterThan(0);
    const hasBloom = steps.some(s => s.type === 'bloom');
    expect(hasBloom).toBe(true);
  });

  it('generates pour steps for multiple pour brewers', () => {
    const v60 = getBrewer('v60');
    const steps = generateFallbackSteps(v60, 15, 16.7, 250);
    const pourCount = steps.filter(s => s.type === 'pour' || s.type === 'bloom').length;
    expect(pourCount).toBeGreaterThanOrEqual(2);
  });

  it('returns empty array for null brewer', () => {
    expect(generateFallbackSteps(null, 15, 16.7, 250)).toEqual([]);
  });

  it('generates immersion steps for French Press', () => {
    const fp = getBrewer('french_press');
    const steps = generateFallbackSteps(fp, 14, 17.8, 250);
    expect(steps.length).toBeGreaterThan(0);
    const hasSteep = steps.some(s => s.type === 'steep');
    expect(hasSteep).toBe(true);
  });
});
