import { describe, it, expect } from 'vitest';
import { translateGrindToGrinder, calibrateCustomGrinder, getGrindLevelDescription } from '../engine/grind';

function parseNum(str) {
  return Number(str.match(/-?\d+(\.\d+)?/)?.[0]);
}

const baratzaEncore = {
  id: 'baratza_encore',
  brand: 'Baratza',
  model: 'Encore',
  setting_type: 'numbers',
  step_size: 1,
  min_setting: 0,
  max_setting: 40,
  micron_range_min: 200,
  micron_range_max: 1200,
};

const comandante = {
  id: 'comandante_c40',
  brand: 'Comandante',
  model: 'C40',
  setting_type: 'clicks',
  step_size: 1,
  min_setting: 0,
  max_setting: 40,
  micron_range_min: 100,
  micron_range_max: 1300,
};

const timemoreC2 = {
  id: 'timemore_c2',
  brand: 'Timemore',
  model: 'C2',
  setting_type: 'clicks',
  step_size: 1,
  min_setting: 0,
  max_setting: 24,
  micron_range_min: 150,
  micron_range_max: 1000,
};

const fellowOde = {
  id: 'fellow_ode_v2',
  brand: 'Fellow',
  model: 'Ode (Gen 2)',
  setting_type: 'numbers',
  step_size: 0.5,
  min_setting: 1,
  max_setting: 11,
  micron_range_min: 200,
  micron_range_max: 1200,
};

describe('translateGrindToGrinder', () => {
  it('returns null for null inputs', () => {
    expect(translateGrindToGrinder(null, baratzaEncore)).toBeNull();
    expect(translateGrindToGrinder('medium', null)).toBeNull();
  });

  it('translates medium-fine to Baratza Encore setting', () => {
    const result = translateGrindToGrinder('medium-fine', baratzaEncore);
    expect(result).toBeTruthy();
    const numeric = parseNum(result);
    expect(numeric).toBeGreaterThanOrEqual(baratzaEncore.min_setting);
    expect(numeric).toBeLessThanOrEqual(baratzaEncore.max_setting);
  });

  it('translates coarse to a higher setting than fine', () => {
    const fine = parseNum(translateGrindToGrinder('fine', baratzaEncore));
    const coarse = parseNum(translateGrindToGrinder('coarse', baratzaEncore));
    expect(coarse).toBeGreaterThan(fine);
  });

  it('returns clicks notation for Comandante', () => {
    const result = translateGrindToGrinder('medium-fine', comandante);
    expect(result).toContain('clicks');
  });

  it('Timemore C2 medium-fine returns integer clicks', () => {
    const result = translateGrindToGrinder('medium-fine', timemoreC2);
    expect(result).toMatch(/^\~\d+ clicks$/);
    const num = parseNum(result);
    expect(Number.isInteger(num)).toBe(true);
  });

  it('Fellow Ode can return half-step values', () => {
    const result = translateGrindToGrinder('medium', fellowOde);
    expect(result).toMatch(/^\~\d+(\.5)?$/);
  });

  it('returns null for custom grinder without calibration', () => {
    const custom = calibrateCustomGrinder(0, 'fine', 40, 'coarse', 1);
    custom.calibrationFineSetting = undefined;
    custom.calibrationCoarseSetting = undefined;
    const result = translateGrindToGrinder('medium', custom);
    expect(result).toBeNull();
  });

  it('linearly interpolates for custom grinder with calibration', () => {
    const custom = calibrateCustomGrinder(5, 'Fine (espresso)', 35, 'Coarse (French press)', 1);
    const result = translateGrindToGrinder('medium', custom);
    expect(result).toBeTruthy();
    const numeric = parseNum(result);
    expect(numeric).toBeGreaterThanOrEqual(5);
    expect(numeric).toBeLessThanOrEqual(35);
  });

  it('preserves fine > coarse direction: fine(35) > coarse(5) maps fine->higher setting', () => {
    const custom = calibrateCustomGrinder(35, 'Fine (espresso)', 5, 'Coarse (French press)', 1);
    const fineResult = translateGrindToGrinder('fine', custom);
    const coarseResult = translateGrindToGrinder('coarse', custom);
    expect(fineResult).toBeTruthy();
    expect(coarseResult).toBeTruthy();
    const fineNum = parseNum(fineResult);
    const coarseNum = parseNum(coarseResult);
    expect(fineNum).toBeGreaterThan(coarseNum);
    expect(fineNum).toBeLessThanOrEqual(35);
    expect(coarseNum).toBeGreaterThanOrEqual(5);
  });

  it('min/max bounds derived from fine and coarse values', () => {
    const custom = calibrateCustomGrinder(35, 'Fine (espresso)', 5, 'Coarse (French press)', 1);
    expect(custom.calibrationFineSetting).toBe(35);
    expect(custom.calibrationCoarseSetting).toBe(5);
    expect(custom.min_setting).toBe(5);
    expect(custom.max_setting).toBe(35);
  });

  it('custom grinder with step_size 2 rounds to multiples of 2', () => {
    const custom = calibrateCustomGrinder(10, 'Fine', 40, 'Coarse', 2);
    const result = translateGrindToGrinder('medium', custom);
    const numeric = parseNum(result);
    expect(numeric % 2).toBe(0);
  });

  it('custom grinder step_size 3 rounds to multiples of 3', () => {
    const custom = calibrateCustomGrinder(10, 'Fine', 40, 'Coarse', 3);
    const result = translateGrindToGrinder('medium', custom);
    const numeric = parseNum(result);
    expect(numeric % 3).toBe(0);
  });

  it('custom grinder with fine > coarse and step_size 4 rounds correctly', () => {
    const custom = calibrateCustomGrinder(36, 'Fine', 8, 'Coarse', 4);
    const fineResult = translateGrindToGrinder('fine', custom);
    const coarseResult = translateGrindToGrinder('coarse', custom);
    expect(fineResult).toBeTruthy();
    expect(coarseResult).toBeTruthy();
    const fineNum = parseNum(fineResult);
    const coarseNum = parseNum(coarseResult);
    expect(fineNum).toBeGreaterThan(coarseNum);
    expect(fineNum % 4).toBe(0);
    expect(coarseNum % 4).toBe(0);
  });

  it('handles edge case: setting near min', () => {
    const result = translateGrindToGrinder('extra-fine', baratzaEncore);
    const numeric = parseNum(result);
    expect(numeric).toBeGreaterThanOrEqual(0);
  });
});

describe('calibrateCustomGrinder', () => {
  it('returns a custom grinder object with correct fields', () => {
    const result = calibrateCustomGrinder(8, 'Espresso', 32, 'French Press', 1);
    expect(result.id).toBe('custom');
    expect(result.calibrationFineSetting).toBe(8);
    expect(result.calibrationCoarseSetting).toBe(32);
    expect(result.min_setting).toBe(8);
    expect(result.max_setting).toBe(32);
    expect(result.calibrationStepSize).toBe(1);
  });

  it('preserves fine > coarse without swapping', () => {
    const result = calibrateCustomGrinder(32, 'Espresso', 8, 'French Press', 1);
    expect(result.calibrationFineSetting).toBe(32);
    expect(result.calibrationCoarseSetting).toBe(8);
    expect(result.calibrationFineLabel).toBe('Espresso');
    expect(result.calibrationCoarseLabel).toBe('French Press');
  });

  it('defaults stepSize to 1 when not provided', () => {
    const result = calibrateCustomGrinder(5, 'Fine', 30, 'Coarse');
    expect(result.calibrationStepSize).toBe(1);
  });

  it('includes stepSize in calibration', () => {
    const result = calibrateCustomGrinder(5, '', 30, '', 3);
    expect(result.calibrationStepSize).toBe(3);
  });
});

describe('getGrindLevelDescription', () => {
  it('returns description with micron range', () => {
    const desc = getGrindLevelDescription('medium-fine');
    expect(desc).toContain('medium-fine');
    expect(desc).toContain('microns');
  });

  it('returns raw value for unknown level', () => {
    const desc = getGrindLevelDescription('unknown');
    expect(desc).toBe('unknown');
  });
});
