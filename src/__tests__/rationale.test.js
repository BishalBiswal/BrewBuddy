import { describe, it, expect } from 'vitest';
import { buildRationaleForBrewer, buildRationaleForFlavorFocus, buildFullRationale } from '../engine/rationale';
import { baseRecipe, adjustForFlavorFocus } from '../engine/recipe';

describe('buildRationaleForBrewer', () => {
  it('includes roast level and brewer name', () => {
    const text = buildRationaleForBrewer('light', 'washed', ['floral', 'citrus'], 'v60');
    expect(text).toContain('light roast');
    expect(text).toContain('washed-processed');
    expect(text).toContain('V60');
  });

  it('handles null tastingNotes', () => {
    const text = buildRationaleForBrewer('medium', 'natural', null, 'aeropress');
    expect(text).toContain('medium roast');
    expect(text).toContain('Aeropress');
  });

  it('handles empty tastingNotes array', () => {
    const text = buildRationaleForBrewer('dark', 'any', [], 'french_press');
    expect(text).toContain('dark roast');
    expect(text).toContain('French Press');
  });

  it('handles unknown roast level gracefully', () => {
    const text = buildRationaleForBrewer(null, null, null, 'v60');
    expect(text).toContain('Unknown roast');
  });
});

describe('buildRationaleForFlavorFocus', () => {
  it('returns empty string for balanced', () => {
    const base = baseRecipe('v60');
    const adjusted = adjustForFlavorFocus(base, 'balanced', 250);
    const text = buildRationaleForFlavorFocus(base, adjusted, 'balanced');
    expect(text).toBe('');
  });

  it('describes changes for brighter acidity', () => {
    const base = baseRecipe('v60');
    const adjusted = adjustForFlavorFocus(base, 'brighter_acidity', 250);
    const text = buildRationaleForFlavorFocus(base, adjusted, 'brighter_acidity');
    expect(text).toContain('Brighter Acidity');
    expect(text).toContain('bright, crisp acidity');
  });

  it('describes changes for more sweetness', () => {
    const base = baseRecipe('v60');
    const adjusted = adjustForFlavorFocus(base, 'more_sweetness_body', 250);
    const text = buildRationaleForFlavorFocus(base, adjusted, 'more_sweetness_body');
    expect(text).toContain('More Sweetness & Body');
  });
});

describe('buildFullRationale', () => {
  it('combines brewer and flavor rationale', () => {
    const base = baseRecipe('v60');
    const adjusted = adjustForFlavorFocus(base, 'more_sweetness_body', 250);
    const text = buildFullRationale('light', 'washed', ['floral'], 'v60', 'more_sweetness_body', base, adjusted);
    expect(text).toContain('V60');
    expect(text).toContain('More Sweetness & Body');
  });

  it('works with balanced focus', () => {
    const base = baseRecipe('v60');
    const adjusted = adjustForFlavorFocus(base, 'balanced', 250);
    const text = buildFullRationale('medium', 'natural', ['berry'], 'v60', 'balanced', base, adjusted);
    expect(text).toContain('medium roast');
    expect(text).not.toContain('focus');
  });
});
