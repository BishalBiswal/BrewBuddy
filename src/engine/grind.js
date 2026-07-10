import brewRules from '../data/brew_rules.json';

const grindLevels = brewRules.grind_levels;
const grindLevelsOrdered = brewRules.grind_levels_ordered;

function getMicronRange(grindRelative) {
  return grindLevels[grindRelative] || null;
}

function roundToStep(value, stepSize) {
  if (!stepSize || stepSize <= 0) stepSize = 1;
  return Math.round(value / stepSize) * stepSize;
}

function formatSetting(value, grinder) {
  const display = grinder.setting_type === 'clicks'
    ? `${value} clicks`
    : `${value}`;
  return `~${display}`;
}

function interpolateSetting(targetMicrons, grinder) {
  const t = (targetMicrons - grinder.micron_range_min) / (grinder.micron_range_max - grinder.micron_range_min);
  const clamped = Math.max(0, Math.min(1, t));
  const setting = grinder.min_setting + clamped * (grinder.max_setting - grinder.min_setting);
  const step = grinder.step_size || 1;
  const rounded = roundToStep(setting, step);
  return formatSetting(rounded, grinder);
}

export function translateGrindToGrinder(grindRelative, grinder) {
  if (!grindRelative || !grinder) {
    return null;
  }

  const micronRange = getMicronRange(grindRelative);
  if (!micronRange) {
    return grindRelative;
  }

  if (grinder.id === 'custom') {
    if (grinder.calibrationFineSetting == null || grinder.calibrationCoarseSetting == null) {
      return null;
    }
    const fineMicrons = 250;
    const coarseMicrons = 1100;
    const targetMid = (micronRange.min_microns + micronRange.max_microns) / 2;
    const t = (targetMid - fineMicrons) / (coarseMicrons - fineMicrons);
    const clamped = Math.max(0, Math.min(1, t));
    const setting = grinder.calibrationFineSetting + clamped * (grinder.calibrationCoarseSetting - grinder.calibrationFineSetting);
    const step = grinder.calibrationStepSize || 1;
    const rounded = roundToStep(setting, step);
    return formatSetting(rounded, grinder);
  }

  const targetMid = (micronRange.min_microns + micronRange.max_microns) / 2;
  return interpolateSetting(targetMid, grinder);
}

export function calibrateCustomGrinder(fineSetting, fineLabel, coarseSetting, coarseLabel, stepSize) {
  return {
    id: 'custom',
    brand: null,
    model: 'Custom / Calibrate',
    setting_type: 'custom',
    step_size: 1,
    min_setting: Math.min(fineSetting, coarseSetting),
    max_setting: Math.max(fineSetting, coarseSetting),
    micron_range_min: null,
    micron_range_max: null,
    calibrationFineSetting: fineSetting,
    calibrationCoarseSetting: coarseSetting,
    calibrationFineLabel: fineLabel || 'Fine',
    calibrationCoarseLabel: coarseLabel || 'Coarse',
    calibrationStepSize: stepSize || 1,
  };
}

export function getGrindLevelDescription(grindRelative) {
  const range = getMicronRange(grindRelative);
  if (!range) return grindRelative;
  return `${grindRelative} (~${range.min_microns}-${range.max_microns} microns)`;
}
