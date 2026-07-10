import brewersData from '../data/brewers.json';
import brewRules from '../data/brew_rules.json';

const flavorAdjustments = brewRules.flavor_focus_adjustments;
const grindLevelsOrdered = brewRules.grind_levels_ordered;

export function baseRecipe(brewerId) {
  const brewer = brewersData.find(b => b.id === brewerId);
  if (!brewer) {
    throw new Error(`Unknown brewer: ${brewerId}`);
  }
  return {
    brewer_id: brewer.id,
    brewer_name: brewer.name,
    ratio: brewer.base_recipe.ratio,
    temp_c: brewer.base_recipe.temp_c,
    grind_relative: brewer.base_recipe.grind_relative,
    total_time_seconds: brewer.base_recipe.total_time_seconds,
    technique_notes: brewer.technique_notes,
    brew_steps: brewer.brew_steps || [],
    temp_c_range: brewer.default_temp_range,
    ratio_range: brewer.default_ratio_range,
  };
}

export function allBaseRecipes() {
  return brewersData.map(b => baseRecipe(b.id));
}

function grindLevelToIndex(grindRelative) {
  return grindLevelsOrdered.indexOf(grindRelative);
}

function indexToGrindLevel(index) {
  const clamped = Math.max(0, Math.min(grindLevelsOrdered.length - 1, Math.round(index)));
  return grindLevelsOrdered[clamped];
}

export function adjustForFlavorFocus(base, flavorFocus, batchSizeMl) {
  const adjustment = flavorAdjustments[flavorFocus];
  if (!adjustment) {
    throw new Error(`Unknown flavor focus: ${flavorFocus}`);
  }

  const grindIdx = grindLevelToIndex(base.grind_relative);
  const adjustedGrindIdx = grindIdx + adjustment.grind_offset_levels;
  const adjustedGrind = indexToGrindLevel(adjustedGrindIdx);

  const adjustedTemp = Math.round((base.temp_c + adjustment.temp_offset_c) * 10) / 10;

  const adjustedRatio = base.ratio + adjustment.ratio_offset;

  const adjustedTime = Math.max(15, Math.round(base.total_time_seconds + adjustment.time_offset_seconds));

  const doseG = Math.round((batchSizeMl / adjustedRatio) * 10) / 10;
  const waterG = Math.round(batchSizeMl);

  return {
    brewer_id: base.brewer_id,
    brewer_name: base.brewer_name,
    flavor_focus: flavorFocus,
    flavor_focus_label: adjustment.label,
    ratio: adjustedRatio,
    dose_g: doseG,
    water_g: waterG,
    water_temp_c: adjustedTemp,
    grind_relative: adjustedGrind,
    grind_grinder_setting: null,
    total_time_seconds: adjustedTime,
    technique_notes: base.technique_notes,
    brew_steps: base.brew_steps || [],
  };
}
