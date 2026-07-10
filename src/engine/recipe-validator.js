import brewersData from '../data/brewers.json';
import brewRules from '../data/brew_rules.json';

const grindLevelsOrdered = brewRules.grind_levels_ordered;

export function validateRecipe(recipe, brewerId) {
  const brewer = brewersData.find(b => b.id === brewerId);
  if (!brewer) return { valid: false, errors: ['Unknown brewer'] };

  const errors = [];
  const { constraints } = brewer;
  const steps = recipe.brew_steps || [];

  if (constraints.ratio_range) {
    if (recipe.ratio < constraints.ratio_range[0] || recipe.ratio > constraints.ratio_range[1]) {
      errors.push(`Ratio ${recipe.ratio} outside range [${constraints.ratio_range}]`);
    }
  }

  if (constraints.temperature_range) {
    const temp = recipe.temperature ?? recipe.water_temp_c;
    if (temp != null && (temp < constraints.temperature_range[0] || temp > constraints.temperature_range[1])) {
      errors.push(`Temperature ${temp} outside range [${constraints.temperature_range}]`);
    }
  }

  if (constraints.brew_time_range) {
    const time = recipe.brew_time ?? recipe.total_time_seconds;
    if (time != null && (time < constraints.brew_time_range[0] || time > constraints.brew_time_range[1])) {
      errors.push(`Brew time ${time}s outside range [${constraints.brew_time_range}]s`);
    }
  }

  const grindIdx = grindLevelsOrdered.indexOf(recipe.grind ?? recipe.grind_relative);
  if (grindIdx === -1) {
    errors.push(`Unknown grind level: ${recipe.grind || recipe.grind_relative}`);
  }

  if (steps.length === 0) {
    errors.push('Recipe has no brew steps');
  }

  if (constraints.supports_multiple_pours) {
    const totalPours = steps.filter(s => s.type === 'pour' || s.type === 'bloom').length;
    if (constraints.min_pours != null && totalPours < constraints.min_pours) {
      errors.push(`Minimum ${constraints.min_pours} pours required, got ${totalPours}`);
    }
    if (constraints.max_pours != null && totalPours > constraints.max_pours) {
      errors.push(`Maximum ${constraints.max_pours} pours allowed, got ${totalPours}`);
    }
  } else {
    const pours = steps.filter(s => s.type === 'pour' || s.type === 'bloom');
    if (pours.length > 1) {
      errors.push('Brewer does not support multiple pours');
    }
  }

  const pourSteps = steps.filter(s => s.type === 'pour' || s.type === 'bloom');
  if (pourSteps.length > 0) {
    const waterSum = pourSteps.reduce((sum, s) => sum + (s.water ?? s.water_fraction ?? 0), 0);
    if (Math.abs(waterSum - 1) > 0.05) {
      errors.push(`water fractions sum to ${waterSum.toFixed(3)}, expected ~1.0`);
    }
  }

  const hasBloom = steps.some(s => s.type === 'bloom' || (s.name && s.name.toLowerCase().includes('bloom')));
  if (!constraints.supports_bloom && hasBloom) {
    errors.push('Brewer does not support bloom');
  }

  const hasSwirl = steps.some(s =>
    (s.agitation && s.agitation.toLowerCase().includes('swirl')) ||
    (s.pour_pattern && s.pour_pattern.toLowerCase().includes('swirl'))
  );
  if (hasSwirl && !constraints.supports_swirl) {
    errors.push('Brewer does not support swirl');
  }

  const hasRaoSpin = steps.some(s =>
    (s.agitation && s.agitation.toLowerCase().includes('rao')) ||
    (s.name && s.name.toLowerCase().includes('rao'))
  );
  if (hasRaoSpin && !constraints.supports_rao_spin) {
    errors.push('Brewer does not support Rao spin');
  }

  const hasStir = steps.some(s => s.agitation && s.agitation.toLowerCase().includes('stir'));
  if (hasStir && !constraints.supports_stir) {
    errors.push('Brewer does not support stirring');
  }

  const hasInversion = steps.some(s =>
    (s.name && s.name.toLowerCase().includes('invert')) ||
    (s.instruction && s.instruction.toLowerCase().includes('invert'))
  );
  if (hasInversion && !constraints.supports_inversion) {
    errors.push('Brewer does not support inversion');
  }

  const hasPressure = steps.some(s =>
    (s.instruction && s.instruction.toLowerCase().includes('press')) ||
    s.type === 'press'
  );
  if (hasPressure && !constraints.supports_pressure) {
    const isAeropress = brewerId === 'aeropress';
    if (!isAeropress) {
      errors.push('Brewer does not support pressure-based steps');
    }
  }

  const hasBypass = steps.some(s =>
    (s.name && s.name.toLowerCase().includes('bypass')) ||
    (s.instruction && s.instruction.toLowerCase().includes('bypass'))
  );
  if (hasBypass && !constraints.supports_bypass) {
    errors.push('Brewer does not support bypass brewing');
  }

  const hasSpiral = steps.some(s =>
    s.pour_pattern && s.pour_pattern.toLowerCase().includes('spiral')
  );
  if (hasSpiral && !constraints.supports_spiral) {
    errors.push('Brewer does not support spiral pours');
  }

  const hasCenter = steps.some(s =>
    s.pour_pattern && s.pour_pattern.toLowerCase().includes('center')
  );
  if (hasCenter && !constraints.supports_center_pour) {
    errors.push('Brewer does not support center pour');
  }

  const hasOsmotic = steps.some(s =>
    s.pour_pattern && s.pour_pattern.toLowerCase().includes('osmotic')
  );
  if (hasOsmotic && !constraints.supports_osmotic) {
    errors.push('Brewer does not support osmotic flow');
  }

  const totalWaterSteps = steps.filter(s => s.type === 'pour' || s.type === 'bloom').length;
  if (!constraints.supports_multiple_pours && totalWaterSteps > 1) {
    errors.push('Brewer does not support multiple water additions');
  }

  return {
    valid: errors.length === 0,
    errors,
    brewerId,
  };
}

export function repairRecipe(recipe, brewerId, validation) {
  if (validation.valid) return recipe;

  const brewer = brewersData.find(b => b.id === brewerId);
  if (!brewer) return recipe;

  const repaired = JSON.parse(JSON.stringify(recipe));
  const { constraints } = brewer;

  if (constraints.ratio_range) {
    repaired.ratio = clamp(repaired.ratio ?? 15, constraints.ratio_range[0], constraints.ratio_range[1]);
  }

  const tempKey = repaired.temperature != null ? 'temperature' : 'water_temp_c';
  if (constraints.temperature_range && (repaired[tempKey] != null)) {
    repaired[tempKey] = clamp(repaired[tempKey], constraints.temperature_range[0], constraints.temperature_range[1]);
  }

  const timeKey = repaired.brew_time != null ? 'brew_time' : 'total_time_seconds';
  if (constraints.brew_time_range && (repaired[timeKey] != null)) {
    repaired[timeKey] = clamp(repaired[timeKey], constraints.brew_time_range[0], constraints.brew_time_range[1]);
  }

  if (repaired.grind && !grindLevelsOrdered.includes(repaired.grind)) {
    repaired.grind = brewer.base_recipe.grind_relative;
  }
  if (repaired.grind_relative && !grindLevelsOrdered.includes(repaired.grind_relative)) {
    repaired.grind_relative = brewer.base_recipe.grind_relative;
  }

  if (validation.errors.some(e => e.includes('water fractions'))) {
    const waterSteps = (repaired.brew_steps || []).filter(s => s.type === 'pour' || s.type === 'bloom');
    const totalWater = waterSteps.reduce((sum, s) => sum + (s.water ?? s.water_fraction ?? 0), 0);
    if (totalWater > 0 && waterSteps.length > 0) {
      const scale = 1 / totalWater;
      for (const step of waterSteps) {
        const v = step.water != null ? 'water' : 'water_fraction';
        step[v] = Math.round((step[v] || 0) * scale * 1000) / 1000;
      }
    }
  }

  if (repaired.brew_steps && Array.isArray(repaired.brew_steps)) {
    repaired.brew_steps = repaired.brew_steps.filter(step => {
      if (step.agitation && step.agitation.toLowerCase().includes('swirl') && !constraints.supports_swirl) {
        step.agitation = 'none';
      }
      if (step.pour_pattern && step.pour_pattern.toLowerCase().includes('spiral') && !constraints.supports_spiral) {
        step.pour_pattern = constraints.supports_center_pour ? 'center' : 'none';
      }
      if (step.pour_pattern && step.pour_pattern.toLowerCase().includes('center') && !constraints.supports_center_pour) {
        step.pour_pattern = constraints.supports_spiral ? 'spiral' : 'none';
      }
      if ((step.name || '').toLowerCase().includes('invert') && !constraints.supports_inversion) {
        step.name = 'Standard Brew';
        step.instruction = (step.instruction || '').replace(/invert/i, '').trim();
      }
      if (step.type === 'bloom' && !constraints.supports_bloom) {
        step.type = 'pour';
        step.name = 'Add Water';
      }
      return true;
    });

    if (!constraints.supports_multiple_pours) {
      const pours = repaired.brew_steps.filter(s => s.type === 'pour');
      if (pours.length > 1) {
        repaired.brew_steps = repaired.brew_steps.filter(s => s.type !== 'pour');
        const allWater = pours.reduce((sum, s) => sum + (s.water ?? s.water_fraction ?? 0), 0);
        const pourPattern = constraints.supports_center_pour ? 'center' : (constraints.supports_spiral ? 'spiral' : 'none');
        repaired.brew_steps.unshift({
          type: 'pour',
          name: 'Add Water',
          start_time: 0,
          duration: 30,
          water: allWater,
          water_fraction: allWater,
          pour_pattern: pourPattern,
          instruction: constraints.supports_center_pour || constraints.supports_spiral
            ? 'Add all water in one pour'
            : 'Add all water',
        });
      }
    }

    const hasBloom = repaired.brew_steps.some(s => s.type === 'bloom');
    if (hasBloom && !constraints.supports_bloom) {
      for (const step of repaired.brew_steps) {
        if (step.type === 'bloom') {
          step.type = 'pour';
          step.name = 'Initial Pour';
        }
      }
    }
  }

  return repaired;
}

function clamp(value, min, max) {
  return Math.round(Math.min(max, Math.max(min, value)) * 10) / 10;
}

export function generateFallbackSteps(brewer, ratio, doseG, waterG) {
  if (!brewer) return [];
  const { constraints } = brewer;
  const steps = [];

  if (constraints.supports_bloom) {
    const bloomWater = Math.round(doseG * 3 * 10) / 10;
    steps.push({
      type: 'bloom',
      name: 'Bloom',
      start_time: 0,
      duration: 30,
      water: bloomWater / waterG,
      water_fraction: Math.round((bloomWater / waterG) * 1000) / 1000,
      pour_pattern: 'spiral',
      agitation: 'none',
      instruction: `Pour ${bloomWater}g water to bloom, let degas for 30s`,
    });
  }

  if (constraints.supports_multiple_pours && constraints.max_pours >= 2) {
    const remainingWater = waterG - (steps.length > 0 ? steps[0].water_fraction * waterG : 0);
    const numPours = Math.min(constraints.max_pours - steps.length, 2);
    const pourAmount = remainingWater / numPours;
    for (let i = 0; i < numPours; i++) {
      const startTime = steps.length > 0 ? steps[steps.length - 1].start_time + steps[steps.length - 1].duration : 30;
      steps.push({
        type: 'pour',
        name: i === 0 ? 'Main Pour' : 'Final Pour',
        start_time: startTime,
        duration: numPours > 1 ? 60 : 90,
        water: pourAmount / waterG,
        water_fraction: Math.round((pourAmount / waterG) * 1000) / 1000,
        pour_pattern: i === 0 ? 'spiral' : 'center',
        agitation: 'none',
        instruction: i === 0
          ? 'Pour in slow concentric circles'
          : 'Gentle center pour to finish',
      });
    }
  } else if (constraints.supports_immersion) {
    steps.push({
      type: 'pour',
      name: 'Add Water',
      start_time: 0,
      duration: 15,
      water: 1,
      water_fraction: 1,
      pour_pattern: 'center',
      agitation: 'stir',
      instruction: 'Pour all water and stir gently',
    });
    steps.push({
      type: 'steep',
      name: 'Steep',
      start_time: 15,
      duration: 150,
      water: 0,
      water_fraction: 0,
      instruction: 'Let steep',
    });
  }

  if (constraints.supports_immersion && brewer.category === 'immersion' && brewer.id !== 'aeropress') {
    steps.push({
      type: 'action',
      name: 'Press & Serve',
      start_time: steps.length > 0 ? steps[steps.length - 1].start_time + steps[steps.length - 1].duration : 180,
      duration: 30,
      water: 0,
      water_fraction: 0,
      instruction: 'Press plunger down slowly and serve',
    });
  }

  if (steps.length === 0) {
    if (brewer.category === 'stovetop' && constraints.supports_pressure) {
      steps.push({
        type: 'action',
        name: 'Fill Base',
        start_time: 0,
        duration: 15,
        water: 1,
        water_fraction: 1,
        instruction: `Fill bottom chamber with ${Math.round(waterG)}g water just below the safety valve`,
      });
      steps.push({
        type: 'action',
        name: 'Brew',
        start_time: 15,
        duration: Math.round(brewer.base_recipe?.total_time_seconds || 300) - 15,
        water: 0,
        water_fraction: 0,
        instruction: 'Add coffee to basket, assemble, place on medium heat. Brew until gurgling, then remove and run base under cool water to stop extraction',
      });
    } else {
      steps.push({
        type: 'action',
        name: 'Brew',
        start_time: 0,
        duration: 60,
        water: 1,
        water_fraction: 1,
        instruction: 'Follow standard method for this brewer',
      });
    }
  }

  return steps;
}
