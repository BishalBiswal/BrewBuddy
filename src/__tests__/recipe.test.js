import { describe, it, expect } from 'vitest';
import { baseRecipe, allBaseRecipes, adjustForFlavorFocus } from '../engine/recipe';

describe('baseRecipe', () => {
  it('returns V60 base recipe', () => {
    const r = baseRecipe('v60');
    expect(r.brewer_id).toBe('v60');
    expect(r.ratio).toBe(15);
    expect(r.temp_c).toBe(94);
    expect(r.grind_relative).toBe('medium-fine');
    expect(r.total_time_seconds).toBe(180);
    expect(r.technique_notes).toBeTruthy();
  });

  it('returns Aeropress base recipe', () => {
    const r = baseRecipe('aeropress');
    expect(r.brewer_id).toBe('aeropress');
    expect(r.ratio).toBe(14);
  });

  it('returns French Press base recipe', () => {
    const r = baseRecipe('french_press');
    expect(r.brewer_id).toBe('french_press');
    expect(r.grind_relative).toBe('coarse');
  });

  it('returns base recipe with empty brew_steps array (dynamic generation)', () => {
    const r = baseRecipe('v60');
    expect(r.brew_steps).toBeTruthy();
    expect(Array.isArray(r.brew_steps)).toBe(true);
    expect(r.brew_steps.length).toBe(0);
  });

  it('throws for unknown brewer', () => {
    expect(() => baseRecipe('nonexistent')).toThrow('Unknown brewer');
  });
});

describe('allBaseRecipes', () => {
  it('returns recipes for all 7 brewers', () => {
    const recipes = allBaseRecipes();
    expect(recipes.length).toBe(7);
    const ids = recipes.map(r => r.brewer_id);
    expect(ids).toContain('v60');
    expect(ids).toContain('aeropress');
    expect(ids).toContain('french_press');
    expect(ids).toContain('moka_pot');
    expect(ids).toContain('espresso');
    expect(ids).toContain('chemex');
    expect(ids).toContain('clever_dripper');
  });

  it('all base recipes have brew_steps array (may be empty for base)', () => {
    const recipes = allBaseRecipes();
    for (const r of recipes) {
      expect(Array.isArray(r.brew_steps)).toBe(true);
    }
  });
});

describe('adjustForFlavorFocus', () => {
  const base = baseRecipe('v60');

  it('returns base recipe unchanged for balanced', () => {
    const adjusted = adjustForFlavorFocus(base, 'balanced', 250);
    expect(adjusted.grind_relative).toBe('medium-fine');
    expect(adjusted.ratio).toBe(15);
    expect(adjusted.water_temp_c).toBe(94);
  });

  it('generates brew_steps dynamically for adjusted recipe', () => {
    const adjusted = adjustForFlavorFocus(base, 'balanced', 250);
    expect(Array.isArray(adjusted.brew_steps)).toBe(true);
    expect(adjusted.brew_steps.length).toBeGreaterThan(0);
  });

  it('brew steps water_fraction values sum to ~1.0 for V60', () => {
    const adjusted = adjustForFlavorFocus(base, 'balanced', 300);
    const pourSteps = adjusted.brew_steps.filter(s => s.type === 'pour' || s.type === 'bloom');
    const totalFraction = pourSteps.reduce((sum, s) => sum + (s.water_fraction || s.water || 0), 0);
    expect(totalFraction).toBeCloseTo(1.0, 1);
  });

  it('water_g scales correctly with batch size', () => {
    const small = adjustForFlavorFocus(base, 'balanced', 200);
    const large = adjustForFlavorFocus(base, 'balanced', 500);
    expect(small.water_g).toBe(200);
    expect(large.water_g).toBe(500);
  });

  it('makes grind finer for brighter acidity', () => {
    const adjusted = adjustForFlavorFocus(base, 'brighter_acidity', 250);
    expect(adjusted.grind_relative).toBe('fine');
  });

  it('makes grind coarser for more sweetness', () => {
    const adjusted = adjustForFlavorFocus(base, 'more_sweetness_body', 250);
    expect(adjusted.grind_relative).toBe('medium');
  });

  it('makes grind coarser for reduce bitterness', () => {
    const adjusted = adjustForFlavorFocus(base, 'reduce_bitterness', 250);
    expect(adjusted.grind_relative).toBe('medium');
  });

  it('adjusts temp for brighter acidity (lower)', () => {
    const adjusted = adjustForFlavorFocus(base, 'brighter_acidity', 250);
    expect(adjusted.water_temp_c).toBeLessThan(base.temp_c);
  });

  it('adjusts temp for more sweetness (higher)', () => {
    const adjusted = adjustForFlavorFocus(base, 'more_sweetness_body', 250);
    expect(adjusted.water_temp_c).toBeGreaterThan(base.temp_c);
  });

  it('computes correct dose for batch size', () => {
    const adjusted = adjustForFlavorFocus(base, 'balanced', 300);
    expect(adjusted.dose_g).toBeCloseTo(20, 0);
    expect(adjusted.water_g).toBe(300);
  });

  it('computes correct dose for non-default ratio', () => {
    const adjusted = adjustForFlavorFocus(base, 'brighter_acidity', 250);
    const expectedDose = 250 / (base.ratio + 0.5);
    expect(adjusted.dose_g).toBeCloseTo(expectedDose, 0);
  });

  it('throws for unknown flavor focus', () => {
    expect(() => adjustForFlavorFocus(base, 'invalid', 250)).toThrow('Unknown flavor focus');
  });
});
