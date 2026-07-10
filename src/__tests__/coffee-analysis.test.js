import { describe, it, expect } from 'vitest';
import { analyzeCoffee, detectPremiumCoffee, isCompetitionGrade } from '../engine/coffee-analysis';

describe('analyzeCoffee', () => {
  it('returns all analysis fields', () => {
    const result = analyzeCoffee({ roastLevel: 'light', process: 'washed', tastingNotes: ['floral', 'citrus'] });
    expect(result).toHaveProperty('fruitiness_score');
    expect(result).toHaveProperty('sweetness_score');
    expect(result).toHaveProperty('clarity_score');
    expect(result).toHaveProperty('body_score');
    expect(result).toHaveProperty('fermentation_score');
    expect(result).toHaveProperty('floral_score');
    expect(result).toHaveProperty('complexity_score');
    expect(result).toHaveProperty('rarity_score');
    expect(result).toHaveProperty('premium_score');
    expect(result).toHaveProperty('expected_solubility');
    expect(result).toHaveProperty('density_estimate');
    expect(result).toHaveProperty('acidity_level');
    expect(result).toHaveProperty('processing_intensity');
  });

  it('washed process has higher clarity than natural', () => {
    const washed = analyzeCoffee({ process: 'washed' });
    const natural = analyzeCoffee({ process: 'natural' });
    expect(washed.clarity_score).toBeGreaterThan(natural.clarity_score);
  });

  it('natural process has higher fruitiness than washed', () => {
    const natural = analyzeCoffee({ process: 'natural' });
    const washed = analyzeCoffee({ process: 'washed' });
    expect(natural.fruitiness_score).toBeGreaterThan(washed.fruitiness_score);
  });

  it('Ethiopian origin has higher floral score than default', () => {
    const ethiopia = analyzeCoffee({ originCountry: 'ethiopia' });
    const empty = analyzeCoffee({});
    expect(ethiopia.floral_score).toBeGreaterThan(empty.floral_score);
  });

  it('light roast has higher acidity than dark roast', () => {
    const light = analyzeCoffee({ roastLevel: 'light' });
    const dark = analyzeCoffee({ roastLevel: 'dark' });
    expect(light.acidity_level).toBeGreaterThan(dark.acidity_level);
  });

  it('gives lower acidity for dark roast than light roast', () => {
    const dark = analyzeCoffee({ roastLevel: 'dark' });
    const light = analyzeCoffee({ roastLevel: 'light' });
    expect(dark.acidity_level).toBeLessThan(light.acidity_level);
  });

  it('detects gesha variety as high rarity', () => {
    const result = analyzeCoffee({ variety: 'gesha' });
    expect(result.rarity_score).toBeGreaterThanOrEqual(7);
    expect(result.premium_score).toBeGreaterThanOrEqual(7);
  });

  it('handles empty input gracefully', () => {
    const result = analyzeCoffee({});
    expect(result.fruitiness_score).toBeGreaterThanOrEqual(0);
    expect(result.clarity_score).toBeGreaterThanOrEqual(0);
  });

  it('gives higher density for high altitude', () => {
    const high = analyzeCoffee({ altitudeM: 2000 });
    const low = analyzeCoffee({ altitudeM: 500 });
    expect(high.density_estimate).toBeGreaterThan(low.density_estimate);
  });

  it('detects anaerobic fermentation is higher than washed', () => {
    const anaerobic = analyzeCoffee({ process: 'anaerobic' });
    const washed = analyzeCoffee({ process: 'washed' });
    expect(anaerobic.fermentation_score).toBeGreaterThan(washed.fermentation_score);
    expect(anaerobic.processing_intensity).toBeGreaterThan(washed.processing_intensity);
  });
});

describe('detectPremiumCoffee', () => {
  it('returns false for null input', () => {
    expect(detectPremiumCoffee(null)).toBe(false);
  });

  it('returns true for high premium score', () => {
    expect(detectPremiumCoffee({ premium_score: 8 })).toBe(true);
  });

  it('returns true for high rarity score', () => {
    expect(detectPremiumCoffee({ premium_score: 3, rarity_score: 8 })).toBe(true);
  });

  it('returns false for low scores', () => {
    expect(detectPremiumCoffee({ premium_score: 3, rarity_score: 3 })).toBe(false);
  });
});

describe('isCompetitionGrade', () => {
  it('returns false for null input', () => {
    expect(isCompetitionGrade(null)).toBe(false);
  });

  it('returns true for high premium and clarity', () => {
    expect(isCompetitionGrade({ premium_score: 8, clarity_score: 7 })).toBe(true);
  });

  it('returns false for low clarity despite premium', () => {
    expect(isCompetitionGrade({ premium_score: 9, clarity_score: 4 })).toBe(false);
  });
});
