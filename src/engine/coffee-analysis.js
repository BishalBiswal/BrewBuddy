import brewRules from '../data/brew_rules.json';

const varietyProfiles = brewRules.coffee_variety_profiles;
const originProfiles = brewRules.origin_profiles;
const processProfiles = brewRules.process_profiles;
const roastProfiles = brewRules.roast_profiles;
const noteProfiles = brewRules.tasting_note_profiles;
const altitudeProfiles = brewRules.altitude_profiles;
const premiumPatterns = brewRules.premium_patterns;

function getOriginKey(country, region) {
  const c = (country || '').toLowerCase().trim();
  const r = (region || '').toLowerCase().trim();

  if (originProfiles[c]) return c;

  const aliases = {
    'brasil': 'brazil',
    'costa rica': 'costa_rica',
    'ethiopia': 'ethiopia',
    'kenya': 'kenya',
    'rwanda': 'rwanda',
    'burundi': 'burundi',
    'colombia': 'colombia',
    'panama': 'panama',
    'guatemala': 'guatemala',
    'yemen': 'yemen',
    'indonesia': 'indonesia',
  };
  if (aliases[c]) return aliases[c];

  if (r === 'yirgacheffe' || r === 'guji' || r === 'sidamo') return 'ethiopia';
  if (r === 'kiambu' || r === 'nyeri' || r === 'kirinyaga') return 'kenya';
  if (r === 'huila' || r === 'narino' || r === 'tolima') return 'colombia';
  if (r === 'boquete' || r === 'volcan') return 'panama';

  return 'default';
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}

function mapVariety(variety) {
  if (!variety) return 'default';
  const v = variety.toLowerCase().trim();
  if (varietyProfiles[v]) return v;
  if (v.includes('geisha') || v.includes('gesha')) return 'gesha';
  if (v.includes('bourbon')) return 'bourbon';
  if (v.includes('typica')) return 'typica';
  if (v.includes('caturra')) return 'caturra';
  if (v.includes('catuai')) return 'catuai';
  if (v.includes('sl28') || v.includes('sl-28')) return 'sl28';
  if (v.includes('sl34') || v.includes('sl-34')) return 'sl34';
  if (v.includes('pacamara')) return 'pacamara';
  if (v.includes('maragogip') || v.includes('maragogyp') || v.includes('margogip')) return 'maragogype';
  if (v.includes('mokka') || v.includes('mokha')) return 'mokka';
  if (v.includes('mundonovo') || v.includes('mundo novo')) return 'mundonovo';
  if (v.includes('castillo')) return 'castillo';
  if (v.includes('colombia')) return 'colombia';
  if (v.includes('tupi')) return 'tupi';
  if (v.includes('icatu')) return 'icatu';
  if (v.includes('rubi')) return 'rubi';
  if (v.includes('sidra')) return 'sidra';
  if (v.includes('eugenioides')) return 'eugenioides';
  if (v.includes('chiroso')) return 'chiroso';
  if (v.includes('rume') || v.includes('sudan')) return 'rume_sudan';
  if (v.includes('wush')) return 'wush_wush';
  if (v.includes('landrace') || v.includes('heirloom')) return 'landrace';
  if (v.includes('liberica')) return 'liberica';
  if (v.includes('java')) return 'java';
  if (v.includes('laurina')) return 'laurina';
  if (v.includes('tabi')) return 'tabi';
  if (v.includes('mayor')) return 'mayor';
  const vFlat = v.replace(/[\s_-]+/g, '');
  let best = null, bestDist = Infinity;
  for (const key of Object.keys(varietyProfiles)) {
    if (key === 'default') continue;
    const k = key.toLowerCase().replace(/[\s_-]+/g, '');
    const dist = levenshtein(vFlat, k);
    const threshold = Math.max(2, Math.floor(Math.min(vFlat.length, k.length) / 3));
    if (dist <= threshold && dist < bestDist) { best = key; bestDist = dist; }
  }
  return best || 'default';
}

function mapProcess(process) {
  if (!process) return 'default';
  const p = process.toLowerCase().trim();
  if (processProfiles[p]) return p;
  if (p.includes('natural')) return 'natural';
  if (p.includes('washed')) return 'washed';
  if (p.includes('honey')) return 'honey';
  if (p.includes('semi') || p.includes('wet hull')) return 'wet-hulled';
  if (p.includes('anaerobic')) return 'anaerobic';
  if (p.includes('carbonic')) return 'carbonic_maceration';
  if (p.includes('coferment') || p.includes('co-ferment') || p.includes('co ferment')) return 'coferment';
  if (p.includes('lactic')) return 'lactic';
  if (p.includes('thermal') || p.includes('shock')) return 'thermal_shock';
  return 'default';
}

function mapRoast(roast) {
  if (!roast) return 'default';
  const r = roast.toLowerCase().trim();
  if (roastProfiles[r]) return r;
  if (r.includes('light-medium') || r.includes('medium-light')) return 'light-medium';
  if (r.includes('medium-dark') || r.includes('dark-medium')) return 'medium-dark';
  if (r.includes('light')) return 'light';
  if (r.includes('medium')) return 'medium';
  if (r.includes('dark')) return 'dark';
  if (r.includes('espresso')) return 'espresso_blend';
  return 'default';
}

function getAltitudeProfile(altitudeM) {
  if (altitudeM == null || !Number.isFinite(altitudeM)) return altitudeProfiles.default;
  const ap = Object.values(altitudeProfiles).find(a =>
    a.min !== undefined && a.max !== undefined && altitudeM >= a.min && altitudeM <= a.max
  );
  return ap || altitudeProfiles.default;
}

function computeNoteProfile(tastingNotes) {
  const profile = { floral_weight: 0, fruitiness_weight: 0, sweetness_weight: 0, acidity_weight: 0, body_weight: 0, clarity_weight: 0, complexity_weight: 0, fermentation_weight: 0, bitterness_weight: 0 };
  if (!tastingNotes || !Array.isArray(tastingNotes)) return profile;
  for (const note of tastingNotes) {
    const key = note.toLowerCase().trim();
    const match = noteProfiles[key];
    if (match) {
      for (const [k, v] of Object.entries(match)) {
        profile[k] = (profile[k] || 0) + v;
      }
    } else {
      const fuzzy = Object.entries(noteProfiles).find(([k]) => key.includes(k));
      if (fuzzy) {
        for (const [k, v] of Object.entries(fuzzy[1])) {
          profile[k] = (profile[k] || 0) + v;
        }
      }
    }
  }
  return profile;
}

function computeWeightedScore(profile, weights) {
  let score = 0;
  let totalWeight = 0;
  for (const [key, weight] of Object.entries(weights)) {
    const pKey = key.replace('_weight', '');
    const v = profile[pKey] ?? 0;
    score += v * weight;
    totalWeight += weight;
  }
  return totalWeight > 0 ? Math.round((score / totalWeight) * 10) / 10 : 5;
}

function clampScore(value) {
  return Math.round(Math.min(10, Math.max(0, value)) * 10) / 10;
}

export function analyzeCoffee(coffeeData) {
  const {
    origin_country, originCountry,
    region,
    variety,
    process,
    altitude_m, altitudeM,
    roast_level, roastLevel,
    tasting_notes, tastingNotes,
    price,
  } = coffeeData;

  const country = origin_country || originCountry || '';
  const alt = altitude_m ?? altitudeM ?? null;
  const roast = roast_level || roastLevel || '';
  const notes = tasting_notes || tastingNotes || [];
  const notesArr = Array.isArray(notes) ? notes : [];

  const originKey = getOriginKey(country, region);
  const varietyKey = mapVariety(variety);
  const processKey = mapProcess(process);
  const roastKey = mapRoast(roast);
  const altProfile = getAltitudeProfile(alt);
  const noteProfile = computeNoteProfile(notesArr);

  const origin = originProfiles[originKey];
  const varietyData = varietyProfiles[varietyKey];
  const processData = processProfiles[processKey];
  const roastData = roastProfiles[roastKey];

  const complexityWeights = {
    origin_complexity: origin.complexity_weight || 4,
    variety_complexity: varietyData.complexity_weight || 3,
    process_complexity: 0,
    note_complexity: noteProfile.complexity_weight || 0,
    altitude_complexity: altProfile.complexity_weight || 5,
  };

  const fruitinessScore = clampScore(
    Math.max(origin.fruitiness_weight || 4, processData.fruitiness_weight || 5) * 0.6 +
    ((origin.fruitiness_weight || 4) + (processData.fruitiness_weight || 5)) / 2 * 0.25 +
    Math.min(5, (noteProfile.fruitiness_weight || 0)) * 0.15
  );

  const sweetnessScore = clampScore(
    Math.max(roastData.sweetness_weight || 5, processData.body_weight || 5) * 0.6 +
    ((roastData.sweetness_weight || 5) + (processData.body_weight || 5)) / 2 * 0.25 +
    Math.min(5, (noteProfile.sweetness_weight || 0)) * 0.15
  );

  const clarityScore = clampScore(
    Math.max(processData.clarity_weight || 5, altProfile.clarity_weight || 5) * 0.5 +
    ((processData.clarity_weight || 5) + (origin.clarity_weight || 4) + (varietyData.clarity_weight || 3)) / 3 * 0.35 +
    Math.min(3, (noteProfile.clarity_weight || 0)) * 0.15
  );

  const bodyScore = clampScore(
    Math.max(roastData.body_weight || 5, processData.body_weight || 5) * 0.6 +
    ((roastData.body_weight || 5) + (processData.body_weight || 5)) / 2 * 0.25 +
    Math.min(5, (noteProfile.body_weight || 0)) * 0.15
  );

  const fermentationScore = clampScore(
    (processData.fermentation_weight || 1) * 0.75 +
    Math.min(5, (noteProfile.fermentation_weight || 0)) * 0.25
  );

  const floralScore = clampScore(
    Math.max(origin.floral_weight || 3, varietyData.floral_weight || 2) * 0.6 +
    ((origin.floral_weight || 3) + (varietyData.floral_weight || 2)) / 2 * 0.25 +
    Math.min(5, (noteProfile.floral_weight || 0)) * 0.15
  );

  const complexityScore = clampScore(
    Math.max(complexityWeights.origin_complexity, complexityWeights.variety_complexity, altProfile.complexity_weight || 5) * 0.5 +
    (complexityWeights.origin_complexity + complexityWeights.variety_complexity + (altProfile.complexity_weight || 5)) / 3 * 0.35 +
    Math.min(5, (noteProfile.complexity_weight || 0)) * 0.15
  );

  const rarityScore = varietyData.rarity_weight || 1;

  let premiumScore = (varietyData.premium_weight || 1) * (processData.fermentation_weight > 5 ? 1.5 : 1);
  for (const pattern of premiumPatterns) {
    let matches = true;
    if (pattern.origins && !pattern.origins.some(o => country.toLowerCase().includes(o))) matches = false;
    if (pattern.varieties && !pattern.varieties.some(v => (variety || '').toLowerCase().includes(v))) matches = false;
    if (pattern.processes && !pattern.processes.some(p => (process || '').toLowerCase().includes(p))) matches = false;
    if (pattern.min_altitude && (!alt || alt < pattern.min_altitude)) matches = false;
    if (pattern.keywords && !pattern.keywords.some(k => (notesArr.join(' ') + ' ' + (variety || '') + ' ' + (country || '')).toLowerCase().includes(k))) matches = false;
    if (matches) premiumScore += pattern.premium_score * 2;
  }
  premiumScore = Math.round(Math.min(10, Math.max(0, premiumScore)) * 10) / 10;

  const expectedSolubility = (roastData.solubility_weight || 5) / 10;
  const densityEstimate = clampScore(Math.max(altProfile.density_weight || 5, roastData.density_weight || 5) * 0.6 + ((altProfile.density_weight || 5) + (roastData.density_weight || 5)) / 2 * 0.4);
  const acidityLevel = clampScore(
    Math.max(roastData.acidity_weight || 5, altProfile.acidity_weight || 5) * 0.55 +
    ((roastData.acidity_weight || 5) + (altProfile.acidity_weight || 5) + (origin.clarity_weight || 4)) / 3 * 0.3 +
    Math.min(5, noteProfile.acidity_weight || 0) * 0.15
  );
  const processingIntensity = clampScore(processData.processing_intensity || 3);

  return {
    fruitiness_score: Math.round(fruitinessScore * 10) / 10,
    sweetness_score: Math.round(sweetnessScore * 10) / 10,
    clarity_score: Math.round(clarityScore * 10) / 10,
    body_score: Math.round(bodyScore * 10) / 10,
    fermentation_score: Math.round(fermentationScore * 10) / 10,
    floral_score: Math.round(floralScore * 10) / 10,
    complexity_score: Math.round(complexityScore * 10) / 10,
    rarity_score: Math.round(rarityScore * 10) / 10,
    premium_score: premiumScore,
    expected_solubility: Math.round(expectedSolubility * 100) / 100,
    density_estimate: Math.round(densityEstimate * 10) / 10,
    acidity_level: Math.round(acidityLevel * 10) / 10,
    processing_intensity: Math.round(processingIntensity * 10) / 10,
  };
}

export function detectPremiumCoffee(analysis) {
  if (!analysis) return false;
  return analysis.premium_score >= 7 || analysis.rarity_score >= 7;
}

export function isCompetitionGrade(analysis) {
  if (!analysis) return false;
  return analysis.premium_score >= 8 && analysis.clarity_score >= 6;
}
