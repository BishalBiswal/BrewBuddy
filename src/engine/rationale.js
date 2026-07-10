import brewRules from '../data/brew_rules.json';
import brewersData from '../data/brewers.json';

const flavorAdjustments = brewRules.flavor_focus_adjustments;

function roastLabel(roastLevel) {
  if (!roastLevel) return 'Unknown roast';
  const labels = {
    'light': 'light roast',
    'light-medium': 'light-medium roast',
    'medium': 'medium roast',
    'medium-dark': 'medium-dark roast',
    'dark': 'dark roast',
    'espresso_blend': 'espresso blend',
  };
  return labels[roastLevel] || `${roastLevel} roast`;
}

function processLabel(process) {
  if (!process) return '';
  const labels = {
    'washed': 'washed-processed',
    'natural': 'natural-processed',
    'honey': 'honey-processed',
    'semi-washed': 'semi-washed',
    'wet-hulled': 'wet-hulled',
  };
  return labels[process] || `${process}-processed`;
}

export function buildRationaleForBrewer(roastLevel, process, tastingNotes, brewerId) {
  const roast = roastLabel(roastLevel);
  const processStr = processLabel(process);
  const brewer = brewersData.find(b => b.id === brewerId);
  const brewerName = brewer ? brewer.name : brewerId;

  let parts = [`This ${roast}`];
  if (processStr) {
    parts.push(processStr);
  }
  if (tastingNotes && tastingNotes.length > 0) {
    const noteStr = Array.isArray(tastingNotes) ? tastingNotes.slice(0, 3).join(', ') : tastingNotes;
    parts.push(`with notes of ${noteStr}`);
  }
  parts.push(`is well-suited to the ${brewerName}.`);

  return parts.join(' ');
}

export function buildRationaleForFlavorFocus(base, adjusted, flavorFocus) {
  const adjustment = flavorAdjustments[flavorFocus];
  if (!adjustment || flavorFocus === 'balanced') {
    return '';
  }

  const deltas = [];
  if (adjusted.grind_relative !== base.grind_relative) {
    deltas.push(`${adjusted.grind_relative} grind`);
  }
  if (adjusted.water_temp_c !== base.temp_c) {
    deltas.push(`${adjusted.water_temp_c}C water`);
  }
  if (Math.abs(adjusted.ratio - base.ratio) > 0.01) {
    deltas.push(`a ${adjusted.ratio}:1 ratio`);
  }
  if (adjusted.total_time_seconds !== base.total_time_seconds) {
    deltas.push(`${adjusted.total_time_seconds}s brew time`);
  }

  if (deltas.length === 0) return '';

  return `"${adjustment.label}" focus: ${deltas.join(', ')} - ${adjustment.description.toLowerCase()}.`;
}

export function buildFullRationale(roastLevel, process, tastingNotes, brewerId, flavorFocus, base, adjusted) {
  const brewerRationale = buildRationaleForBrewer(roastLevel, process, tastingNotes, brewerId);
  const flavorRationale = buildRationaleForFlavorFocus(base, adjusted, flavorFocus);
  if (flavorRationale) {
    return `${brewerRationale} ${flavorRationale}`;
  }
  return brewerRationale;
}
