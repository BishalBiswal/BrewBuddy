import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { buildChatProvidersFromEnv, describeChatProviders, tryProviders } from './llm-providers.mjs';

function loadEnvFile(filePath, target = process.env) {
  if (!fs.existsSync(filePath)) return target;
  const lines = fs.readFileSync(filePath, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (key && !target[key]) target[key] = value;
  }
  return target;
}

function readRuntimeEnv() {
  const runtimeEnv = { ...process.env };
  loadEnvFile(path.resolve(process.cwd(), '.env'), runtimeEnv);
  loadEnvFile(path.resolve(process.cwd(), '.env.local'), runtimeEnv);
  return runtimeEnv;
}

const PORT = process.env.PORT || process.env.EXTRACT_PORT || 3001;
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || 'helloworld';
const OCR_SPACE_URL = process.env.OCR_SPACE_URL || 'https://api.ocr.space/parse/image';
const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_TOKEN || '';
const HF_MODEL = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct:fastest';
const HF_CHAT_URL = process.env.HF_CHAT_URL || 'https://router.huggingface.co/v1/chat/completions';

const brewers = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/data/brewers.json'), 'utf-8'));
const brewRules = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'src/data/brew_rules.json'), 'utf-8'));

const EXPECTED_FIELDS = [
  'roaster', 'coffee_name', 'origin_country', 'region',
  'farm_or_coop', 'variety', 'process', 'roast_level',
  'altitude_m', 'tasting_notes', 'roast_date', 'flavor_tags',
];

const RECIPE_GRIND_LEVELS = brewRules.grind_levels_ordered || [
  'extra-fine', 'fine', 'medium-fine', 'medium', 'medium-coarse', 'coarse', 'extra-coarse',
];

const RECIPE_STYLES = brewRules.recipe_styles || {};
const TECHNIQUES = brewRules.techniques || {};

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(JSON.stringify(data));
}

function normalizeArray(value) {
  if (Array.isArray(value)) return value.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim());
  if (typeof value === 'string' && value.trim()) return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeExtraction(parsed, rawOcrText) {
  const cleaned = {};
  for (const field of EXPECTED_FIELDS) cleaned[field] = parsed?.[field] ?? null;
  cleaned.tasting_notes = normalizeArray(cleaned.tasting_notes);
  cleaned.flavor_tags = normalizeArray(cleaned.flavor_tags);
  cleaned.altitude_m = Number.isFinite(Number(cleaned.altitude_m)) ? Number(cleaned.altitude_m) : null;
  cleaned.raw_ocr_text = rawOcrText;
  return cleaned;
}

function extractJson(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) throw new Error('Empty LLM response');
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON object in LLM response');
    return JSON.parse(match[0]);
  }
}

function hasSupportedMediaType(mediaType) {
  return ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff'].includes(String(mediaType).toLowerCase());
}

async function runOnlineOcr(imageData, mediaType) {
  const params = new URLSearchParams();
  params.set('apikey', OCR_SPACE_API_KEY);
  params.set('base64Image', `data:${mediaType};base64,${imageData}`);
  params.set('language', 'eng');
  params.set('isOverlayRequired', 'false');
  params.set('scale', 'true');
  params.set('OCREngine', process.env.OCR_SPACE_ENGINE || '2');

  const response = await fetch(OCR_SPACE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params,
  });

  if (!response.ok) throw new Error(`OCR.space returned ${response.status}`);
  const data = await response.json();
  if (data.IsErroredOnProcessing) {
    const message = Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join('; ') : data.ErrorMessage;
    throw new Error(message || 'OCR.space failed to process image');
  }

  const text = (data.ParsedResults || [])
    .map((result) => result.ParsedText || '')
    .join('\n')
    .trim();

  if (!text) throw new Error('OCR produced no text');
  return text;
}

function buildPrompt(rawOcrText) {
  return `You structure OCR text from a coffee bag label into strict JSON. Return ONLY valid JSON with these exact fields: ${EXPECTED_FIELDS.join(', ')}.

Rules:
- Missing or unreadable scalar fields must be null.
- tasting_notes and flavor_tags must be arrays of strings.
- altitude_m must be a number or null.
- roast_level must be one of: light, light-medium, medium, medium-dark, dark, espresso_blend, or null.
- process must be one of: washed, natural, honey, semi-washed, wet-hulled, anaerobic, carbonic_maceration, coferment, lactic, thermal_shock, or null.
- roast_date must be YYYY-MM-DD if clear, otherwise null.
- Do not invent facts that are not present in the OCR text.
- No prose. No markdown fences.

OCR text:
${rawOcrText}`;
}

function getChatProviders() {
  return buildChatProvidersFromEnv(readRuntimeEnv());
}

async function callHuggingFace(messages, { temperature = 0, maxTokens = 700 } = {}) {
  const { result } = await tryProviders(getChatProviders(), async (provider) => provider.call(messages, { temperature, maxTokens }));
  return result;
}

async function structureWithHuggingFace(rawOcrText) {
  const { result } = await tryProviders(getChatProviders(), async (provider) => {
    const text = await provider.call([
      { role: 'system', content: 'Return only strict JSON. No prose. No markdown.' },
      { role: 'user', content: buildPrompt(rawOcrText) },
    ], { temperature: 0, maxTokens: 500, responseFormat: { type: 'json_object' } });
    return extractJson(text);
  });
  return result;
}

function normalizeCoffeeData(input = {}) {
  return {
    coffeeName: input.coffeeName || input.coffee_name || '',
    roaster: input.roaster || '',
    originCountry: input.originCountry || input.origin_country || '',
    region: input.region || '',
    variety: input.variety || '',
    roastLevel: input.roastLevel || input.roast_level || '',
    process: input.process || '',
    tastingNotes: normalizeArray(input.tastingNotes || input.tasting_notes),
    altitudeM: Number.isFinite(Number(input.altitudeM ?? input.altitude_m)) ? Number(input.altitudeM ?? input.altitude_m) : null,
    roastDate: input.roastDate || input.roast_date || '',
  };
}

function normalizeNumber(value, fallback, { min = -Infinity, max = Infinity, decimals = 1 } = {}) {
  const number = Number(value);
  const safe = Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  const factor = 10 ** decimals;
  return Math.round(safe * factor) / factor;
}

function normalizeStep(step, index, fallbackWaterFraction) {
  return {
    type: typeof step?.type === 'string' ? step.type : 'action',
    name: typeof step?.name === 'string' && step.name.trim() ? step.name.trim() : (step.label || `Step ${index + 1}`),
    start_time: Math.max(0, Math.round(Number(step?.start_time ?? step?.time_sec ?? 0))),
    duration: Math.max(0, Math.round(Number(step?.duration ?? step?.duration_sec ?? 0))),
    water: normalizeNumber(step?.water ?? step?.water_fraction, fallbackWaterFraction, { min: 0, max: 1, decimals: 3 }),
    pour_pattern: step?.pour_pattern || 'center',
    agitation: step?.agitation || 'none',
    instruction: typeof step?.instruction === 'string' && step.instruction.trim() ? step.instruction.trim() : 'Follow standard technique.',
  };
}

function generateFallbackSteps(brewer, waterG) {
  if (!brewer) return [];
  const { constraints } = brewer;
  if (!constraints) return [];
  const steps = [];

  if (brewer.category === 'stovetop' && constraints.supports_pressure) {
    steps.push({
      type: 'action',
      name: 'Fill Base',
      start_time: 0,
      duration: 15,
      water: 1,
      instruction: `Fill bottom chamber with ${Math.round(waterG)}g water just below the safety valve`,
    });
    steps.push({
      type: 'action',
      name: 'Brew',
      start_time: 15,
      duration: Math.round((brewer.base_recipe?.total_time_seconds || 300) - 15),
      water: 0,
      instruction: 'Add coffee to basket, assemble, place on medium heat. Brew until gurgling, then remove from heat',
    });
    return steps;
  }

  if (constraints.supports_bloom) {
    const bloomFraction = constraints.supports_variable_bloom ? 0.15 : 0.2;
    steps.push({
      type: 'bloom',
      name: 'Bloom',
      start_time: 0,
      duration: 30,
      water: bloomFraction,
      pour_pattern: 'spiral',
      agitation: 'none',
      instruction: `Pour ${Math.round(bloomFraction * waterG)}g water to bloom, let degas`,
    });
  }

  if (constraints.supports_multiple_pours && constraints.max_pours >= 2) {
    const remainingWater = 1 - steps.reduce((s, st) => s + (st.water || 0), 0);
    const numPours = Math.min(constraints.max_pours - steps.length, 3);
    const pourAmount = remainingWater / numPours;
    for (let i = 0; i < numPours; i++) {
      const startTime = steps.length > 0 ? steps[steps.length - 1].start_time + steps[steps.length - 1].duration : 30;
      steps.push({
        type: 'pour',
        name: i === 0 ? 'Main Pour' : i === 1 ? 'Second Pour' : 'Final Pour',
        start_time: startTime,
        duration: numPours > 1 ? 60 : 90,
        water: Math.round(pourAmount * 1000) / 1000,
        pour_pattern: i === 0 ? 'spiral' : 'center',
        agitation: 'none',
        instruction: i === 0 ? 'Pour in slow concentric circles' : 'Gentle center pour to finish',
      });
    }
  } else if (constraints.supports_immersion) {
    steps.push({
      type: 'pour',
      name: 'Add Water',
      start_time: 0,
      duration: 15,
      water: 1,
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
      instruction: 'Let steep',
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
        instruction: `Fill bottom chamber with ${Math.round(waterG)}g water just below the safety valve`,
      });
      steps.push({
        type: 'action',
        name: 'Brew',
        start_time: 15,
        duration: Math.round((brewer.base_recipe?.total_time_seconds || 300) - 15),
        water: 0,
        instruction: 'Add coffee to basket, assemble, place on medium heat. Brew until gurgling, then remove from heat',
      });
    } else {
      steps.push({
        type: 'action',
        name: 'Brew',
        start_time: 0,
        duration: 60,
        water: 1,
        instruction: 'Follow standard method for this brewer',
      });
    }
  }

  return steps;
}

function normalizeGeneratedRecipe(parsed, brewer, batchSizeMl, flavorFocus) {
  const recipe = parsed?.recipe || parsed || {};
  const flavorAdj = brewRules.flavor_focus_adjustments?.[flavorFocus] || brewRules.flavor_focus_adjustments?.balanced || { label: flavorFocus };
  const base = brewer.base_recipe;
  const constraints = brewer.constraints || {};
  const ratioRange = constraints.ratio_range || brewer.default_ratio_range || [10, 18];

  const ratio = normalizeNumber(recipe.ratio, base.ratio, { min: ratioRange[0], max: ratioRange[1], decimals: 1 });
  const waterG = Math.round(normalizeNumber(recipe.water_g, batchSizeMl, { min: 30, max: 1500, decimals: 0 }));
  const doseG = normalizeNumber(recipe.dose_g, waterG / ratio, { min: 1, max: 200, decimals: 1 });
  const grind = RECIPE_GRIND_LEVELS.includes(recipe.grind_relative) ? recipe.grind_relative :
    RECIPE_GRIND_LEVELS.includes(recipe.grind) ? recipe.grind :
    base.grind_relative;

  const tempRange = constraints.temperature_range || brewer.default_temp_range || [80, 100];
  const temp = normalizeNumber(recipe.water_temp_c ?? recipe.temperature ?? recipe.temp_c, base.temp_c, { min: tempRange[0], max: tempRange[1], decimals: 1 });

  const rawSteps = Array.isArray(recipe.brew_steps) && recipe.brew_steps.length > 0
    ? recipe.brew_steps
    : generateFallbackSteps(brewer, waterG);
  const fallbackFraction = rawSteps.length ? 1 / Math.max(1, rawSteps.filter(s => s.type === 'pour' || s.type === 'bloom').length) : 0;

  return {
    recipe: {
      recipe_name: recipe.recipe_name || `${brewer.name} Recipe`,
      recipe_style: recipe.recipe_style || '',
      difficulty: recipe.difficulty || 'intermediate',
      brewing_philosophy: recipe.brewing_philosophy || '',
      why_this_recipe: recipe.why_this_recipe || '',
      brewer_id: brewer.id,
      brewer_name: brewer.name,
      flavor_focus: flavorFocus,
      flavor_focus_label: recipe.flavor_focus_label || flavorAdj.label || flavorFocus,
      ratio,
      dose_g: doseG,
      water_g: waterG,
      temperature: temp,
      water_temp_c: temp,
      grind: grind,
      grind_relative: grind,
      grind_grinder_setting: recipe.grind_grinder_setting || null,
      brew_time: Math.max(15, Math.round(Number(recipe.brew_time ?? recipe.total_time_seconds) || base.total_time_seconds)),
      total_time_seconds: Math.max(15, Math.round(Number(recipe.total_time_seconds ?? recipe.brew_time) || base.total_time_seconds)),
      target_tds: normalizeNumber(recipe.target_tds, null, { min: 0.5, max: 3, decimals: 2 }) || undefined,
      target_extraction: normalizeNumber(recipe.target_extraction, null, { min: 10, max: 30, decimals: 1 }) || undefined,
      expected_flavor: typeof recipe.expected_flavor === 'string' ? recipe.expected_flavor.trim() : '',
      agitation: recipe.agitation || 'none',
      brew_steps: rawSteps.map((step, index) => normalizeStep(step, index, fallbackFraction)),
      dial_in_notes: typeof recipe.dial_in_notes === 'string' ? recipe.dial_in_notes.trim() : '',
      alternate_recipe: typeof recipe.alternate_recipe === 'string' ? recipe.alternate_recipe.trim() : '',
      avoid: typeof recipe.avoid === 'string' ? recipe.avoid.trim() : '',
      tips: typeof recipe.tips === 'string' ? recipe.tips.trim() : '',
    },
    rationale: typeof parsed?.rationale === 'string' ? parsed.rationale.trim() : '',
    suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions.map((suggestion) => ({
      brewer_id: suggestion.brewer_id || null,
      brewer_name: suggestion.brewer_name || suggestion.name || suggestion.brewer_id || 'Alternative',
      rationale: suggestion.rationale || '',
    })).filter((suggestion) => suggestion.rationale) : [],
  };
}

function computeCoffeeAnalysis(coffeeData) {
  const analysis = {
    fruitiness_score: 5,
    sweetness_score: 5,
    clarity_score: 5,
    body_score: 5,
    fermentation_score: 3,
    floral_score: 3,
    complexity_score: 5,
    rarity_score: 1,
    premium_score: 1,
    expected_solubility: 0.5,
    density_estimate: 5,
    acidity_level: 5,
    processing_intensity: 4,
  };

  const process = (coffeeData.process || '').toLowerCase();
  const roast = (coffeeData.roastLevel || coffeeData.roast_level || '').toLowerCase();
  const notes = coffeeData.tastingNotes || coffeeData.tasting_notes || [];
  const notesArr = Array.isArray(notes) ? notes : [];
  const variety = (coffeeData.variety || '').toLowerCase();
  const country = (coffeeData.originCountry || coffeeData.origin_country || '').toLowerCase();
  const alt = coffeeData.altitudeM ?? coffeeData.altitude_m ?? null;

  if (process.includes('natural')) { analysis.fruitiness_score = 7; analysis.body_score = 7; analysis.fermentation_score = 5; analysis.processing_intensity = 6; }
  if (process.includes('washed')) { analysis.clarity_score = 7; analysis.fermentation_score = 1; analysis.processing_intensity = 2; }
  if (process.includes('honey')) { analysis.sweetness_score = 7; analysis.body_score = 6; analysis.clarity_score = 5; }
  if (process.includes('anaerobic') || process.includes('carbonic')) { analysis.fermentation_score = 9; analysis.complexity_score = 7; analysis.processing_intensity = 9; }
  if (process.includes('coferment') || process.includes('co-ferment')) { analysis.fermentation_score = 9; analysis.fruitiness_score = Math.max(analysis.fruitiness_score, 7); analysis.processing_intensity = 9; }
  if (process.includes('lactic')) { analysis.fermentation_score = 8; analysis.body_score = 6; analysis.processing_intensity = 8; }
  if (process.includes('thermal') || process.includes('shock')) { analysis.fermentation_score = 7; analysis.complexity_score = 6; analysis.processing_intensity = 8; }
  if (process.includes('wet hull') || process.includes('giling')) { analysis.body_score = 8; analysis.clarity_score = 3; }

  if (roast.includes('light')) { analysis.acidity_level = 7; analysis.body_score = Math.min(analysis.body_score, 4); analysis.expected_solubility = 0.35; }
  if (roast.includes('medium') && !roast.includes('-')) { analysis.acidity_level = 5; analysis.expected_solubility = 0.5; }
  if (roast.includes('dark')) { analysis.acidity_level = 2; analysis.body_score = Math.max(analysis.body_score, 6); analysis.sweetness_score = Math.max(analysis.sweetness_score, 4); analysis.expected_solubility = 0.75; }

  if (country.includes('ethiopia')) { analysis.floral_score = 8; analysis.complexity_score = 7; analysis.fruitiness_score = Math.max(analysis.fruitiness_score, 6); }
  if (country.includes('kenya')) { analysis.complexity_score = 7; analysis.clarity_score = Math.max(analysis.clarity_score, 6); }
  if (country.includes('panama')) { analysis.clarity_score = Math.max(analysis.clarity_score, 7); analysis.complexity_score = Math.max(analysis.complexity_score, 6); }

  if (variety.includes('geisha') || variety.includes('gesha')) { analysis.rarity_score = 9; analysis.premium_score = 9; analysis.floral_score = 9; analysis.clarity_score = 9; }
  if (variety.includes('eugenioides')) { analysis.rarity_score = 10; analysis.premium_score = 10; analysis.complexity_score = 9; }
  if (variety.includes('bourbon')) { analysis.rarity_score = 3; analysis.sweetness_score = Math.max(analysis.sweetness_score, 6); }
  if (variety.includes('laurina')) { analysis.rarity_score = 8; analysis.premium_score = 8; analysis.clarity_score = Math.max(analysis.clarity_score, 7); }
  if (variety.includes('sidra')) { analysis.rarity_score = 7; analysis.premium_score = 7; analysis.complexity_score = Math.max(analysis.complexity_score, 7); }
  if (variety.includes('chiroso')) { analysis.rarity_score = 6; analysis.premium_score = 6; analysis.clarity_score = Math.max(analysis.clarity_score, 6); }
  if (variety.includes('pacamara')) { analysis.rarity_score = 6; analysis.premium_score = 6; analysis.body_score = Math.max(analysis.body_score, 6); }
  if (variety.includes('mokka') || variety.includes('mokha')) { analysis.rarity_score = 7; analysis.premium_score = 7; analysis.floral_score = Math.max(analysis.floral_score, 7); }
  if (variety.includes('sl28')) { analysis.rarity_score = 5; analysis.premium_score = 5; analysis.clarity_score = Math.max(analysis.clarity_score, 6); }
  if (variety.includes('sl34')) { analysis.rarity_score = 5; analysis.premium_score = 5; analysis.clarity_score = Math.max(analysis.clarity_score, 6); }
  if (variety.includes('tabi')) { analysis.premium_score = Math.max(analysis.premium_score, 4); }
  if (variety.includes('maragogip') || variety.includes('margogip')) { analysis.rarity_score = 5; analysis.premium_score = 5; }
  if (variety.includes('java')) { analysis.complexity_score = Math.max(analysis.complexity_score, 4); }
  if (variety.includes('caturra')) { analysis.clarity_score = Math.max(analysis.clarity_score, 5); }
  if (variety.includes('typica')) { }
  if (variety.includes('catuai')) { }
  if (variety.includes('mayor')) { analysis.premium_score = Math.max(analysis.premium_score, 4); }
  if (variety.includes('mundonovo') || variety.includes('mundo novo')) { analysis.body_score = Math.max(analysis.body_score, 5); }
  if (variety.includes('castillo')) { analysis.clarity_score = Math.max(analysis.clarity_score, 5); }
  if (variety.includes('tupi')) { analysis.clarity_score = Math.max(analysis.clarity_score, 5); }
  if (variety.includes('icatu')) { analysis.body_score = Math.max(analysis.body_score, 5); }
  if (variety.includes('rubi')) { analysis.sweetness_score = Math.max(analysis.sweetness_score, 5); }
  if (variety.includes('rume') || variety.includes('sudan')) { analysis.rarity_score = 8; analysis.premium_score = 8; analysis.complexity_score = Math.max(analysis.complexity_score, 7); }
  if (variety.includes('wush')) { analysis.rarity_score = 7; analysis.premium_score = 7; analysis.floral_score = Math.max(analysis.floral_score, 7); }
  if (variety.includes('landrace') || variety.includes('heirloom')) { analysis.complexity_score = Math.max(analysis.complexity_score, 5); }
  if (variety.includes('liberica')) { analysis.rarity_score = 7; analysis.premium_score = 7; analysis.floral_score = Math.max(analysis.floral_score, 6); }

  if (alt != null && Number.isFinite(Number(alt))) {
    const altitude = Number(alt);
    if (altitude > 1800) { analysis.acidity_level = Math.min(10, analysis.acidity_level + 2); analysis.density_estimate = 8; analysis.complexity_score = Math.min(10, analysis.complexity_score + 1); }
    else if (altitude > 1400) { analysis.acidity_level = Math.min(10, analysis.acidity_level + 1); analysis.density_estimate = 6; }
  }

  for (const note of notesArr) {
    const n = note.toLowerCase();
    if (['floral', 'jasmine', 'rose', 'lavender'].includes(n)) analysis.floral_score = Math.min(10, analysis.floral_score + 2);
    if (['berry', 'fruit', 'tropical', 'mango', 'pineapple'].includes(n)) analysis.fruitiness_score = Math.min(10, analysis.fruitiness_score + 2);
    if (['chocolate', 'caramel', 'brown sugar', 'honey', 'sweet'].includes(n)) analysis.sweetness_score = Math.min(10, analysis.sweetness_score + 2);
    if (['citrus', 'lemon', 'lime', 'grapefruit'].includes(n)) analysis.acidity_level = Math.min(10, analysis.acidity_level + 2);
    if (['wine', 'fermented', 'boozy', 'rum'].includes(n)) analysis.fermentation_score = Math.min(10, analysis.fermentation_score + 2);
    if (['creamy', 'buttery', 'syrupy'].includes(n)) analysis.body_score = Math.min(10, analysis.body_score + 2);
  }

  for (const key of Object.keys(analysis)) {
    analysis[key] = Math.round(analysis[key] * 10) / 10;
  }

  return analysis;
}

function computeBrewIntent(analysis, flavorFocus) {
  const intent = {
    clarityPriority: Math.min(10, Math.max(1, Math.round(analysis.clarity_score * 1.2))),
    sweetnessPriority: Math.min(10, Math.max(1, Math.round(analysis.sweetness_score * 1.1))),
    bodyPriority: Math.min(10, Math.max(1, Math.round(analysis.body_score * 1.1))),
    competitionStyle: analysis.premium_score >= 6 && analysis.clarity_score >= 6,
    premiumCoffee: analysis.premium_score >= 7,
    gentleExtraction: analysis.premium_score >= 6 && analysis.processing_intensity < 6,
    highExtraction: analysis.premium_score < 6 && analysis.body_score >= 5,
    lowAgitation: analysis.fermentation_score >= 6 || (analysis.clarity_score >= 7 && analysis.premium_score >= 6),
    highAgitation: analysis.body_score >= 6 && analysis.processing_intensity >= 5 && analysis.premium_score < 6,
    fruitForward: analysis.fruitiness_score >= 6,
    comfortCup: analysis.sweetness_score >= 6 && analysis.body_score >= 5 && analysis.premium_score < 6,
    experimental: analysis.fermentation_score >= 7 && analysis.complexity_score >= 6,
  };

  if (flavorFocus === 'brighter_acidity') {
    intent.clarityPriority = Math.min(10, intent.clarityPriority + 2);
    intent.comfortCup = false;
  } else if (flavorFocus === 'more_sweetness_body') {
    intent.sweetnessPriority = Math.min(10, intent.sweetnessPriority + 2);
    intent.bodyPriority = Math.min(10, intent.bodyPriority + 2);
    intent.comfortCup = true;
    intent.gentleExtraction = false;
  } else if (flavorFocus === 'reduce_bitterness') {
    intent.gentleExtraction = true;
    intent.lowAgitation = true;
    intent.highExtraction = false;
    intent.highAgitation = false;
  }

  return intent;
}

function buildRecipePrompt({ coffeeData, brewer, batchSizeMl, flavorFocus }) {
  const analysis = computeCoffeeAnalysis(coffeeData);
  const intent = computeBrewIntent(analysis, flavorFocus);
  const constraints = brewer.constraints || {};
  const otherBrewers = brewers.filter((b) => b.id !== brewer.id).map((b) => ({ id: b.id, name: b.name, category: b.category }));

  const styleKeys = Object.keys(RECIPE_STYLES);
  const techniqueKeys = Object.keys(TECHNIQUES);

  return `Generate a coffee brewing recipe as strict JSON. Return ONLY JSON, no markdown or other text.

Your role: You are a World Brewers Cup level coffee brewing expert. Design a dynamic, creative recipe specifically for THIS coffee and THIS brewer. Do NOT use generic steps — invent a recipe that suits the coffee's unique characteristics.

COFFEE ANALYSIS:
${JSON.stringify(analysis, null, 2)}

BREW INTENT (guide for recipe design):
${JSON.stringify(intent, null, 2)}

BREWER CAPABILITIES:
${JSON.stringify({
  id: brewer.id,
  name: brewer.name,
  category: brewer.category,
  constraints: constraints,
  default_ratio_range: brewer.default_ratio_range,
  default_temp_range: brewer.default_temp_range,
  base_recipe: brewer.base_recipe,
}, null, 2)}

AVAILABLE RECIPE STYLES (choose one that best fits):
${JSON.stringify(styleKeys, null, 2)}

AVAILABLE TECHNIQUES (use as appropriate):
${JSON.stringify(techniqueKeys, null, 2)}

USER CHOICES:
${JSON.stringify({ batch_size_ml: batchSizeMl, flavor_focus: flavorFocus }, null, 2)}

ALTERNATIVE METHODS:
${JSON.stringify(otherBrewers, null, 2)}

OUTPUT SCHEMA (return ONLY this JSON):
{
  "recipe": {
    "recipe_name": "string - a descriptive name like 'Fruity Competition V60'",
    "recipe_style": "string - one of the recipe styles above",
    "difficulty": "beginner|intermediate|advanced",
    "brewing_philosophy": "string - 1-2 sentences explaining the approach",
    "why_this_recipe": "string - why this specific recipe suits this coffee",
    "ratio": number,
    "dose_g": number,
    "water_g": number,
    "water_temp_c": number,
    "grind_relative": "string - one of ${RECIPE_GRIND_LEVELS.join(', ')}",
    "total_time_seconds": number,
    "target_tds": number (optional, 1.15-1.6 range typical),
    "target_extraction": number (optional, 18-24% range typical),
    "expected_flavor": "string - what the brewer should taste",
    "agitation": "string - overall agitation approach",
    "brew_steps": [
      {
        "type": "bloom|pour|steep|action|drawdown",
        "name": "string - descriptive step name",
        "start_time": number - seconds from start,
        "duration": number - seconds this step takes,
        "water": number - fraction of total water (sum must = 1.0 for pour/bloom steps),
        "pour_pattern": "center|spiral|pulse|continuous|osmotic",
        "agitation": "none|gentle_swirl|rao_spin|stir|bloom_stir",
        "instruction": "string - detailed instruction"
      }
    ],
    "dial_in_notes": "string - how to adjust if needed",
    "alternate_recipe": "string - a simpler alternative approach",
    "avoid": "string - what to avoid with this recipe",
    "tips": "string - pro tips"
  },
  "rationale": "string - 2-3 sentences explaining overall recipe logic",
  "suggestions": [
    { "brewer_id": "string", "brewer_name": "string", "rationale": "string" }
  ]
}

RULES:
- BE CREATIVE but scientifically valid. Design a recipe specific to this coffee's profile.
- Bloom should be 15-25% of total water unless the coffee profile justifies a different approach.
- For high clarity coffees (washed, high altitude), use more pours with gentle agitation.
- For high body coffees (natural, dark roast), use fewer pours with more agitation.
- For premium/competition coffees, use extended bloom, multiple pours, minimal agitation.
- For dark roasts, use lower temperature, fewer pours, coarser grind.
- For light roasts, use higher temperature, more pours, finer grind.
- The water fractions of pour+bloom steps must sum to 1.0.
- Respect the brewer's capabilities from constraints above. Check supports_bloom, supports_multiple_pours, supports_center_pour, supports_spiral, supports_immersion, supports_pressure, supports_stir, supports_swirl flags. DO NOT use features the brewer doesn't support.
- For stovetop brewers (Moka Pot), the brewer has a sealed bottom chamber — there are no pours or pour patterns. Steps should describe filling the base, assembling, and brewing on the stove.
- For espresso brewers, steps should describe dosing, tamping, and pulling the shot — no pour patterns or bloom.
- Dose must = water_g / ratio.
- water_g should match batch_size_ml.
- Suggestions must recommend 2-3 alternative methods with rationale.`;
}

async function generateRecipeWithHuggingFace(payload) {
  const { result } = await tryProviders(getChatProviders(), async (provider) => {
    const text = await provider.call([
      { role: 'system', content: 'You are a World Brewers Cup level coffee brewing expert. Return only strict JSON matching the requested schema. No markdown fences, no prose outside the JSON.' },
      { role: 'user', content: buildRecipePrompt(payload) },
    ], { temperature: 0.3, maxTokens: 1200, responseFormat: { type: 'json_object' } });
    return extractJson(text);
  });
  return result;
}

async function handleExtract(req, res) {
  let body;
  try {
    body = await parseBody(req);
  } catch {
    sendJSON(res, 400, { error: 'Invalid request body' });
    return;
  }

  const { imageData, mediaType } = body;
  if (!imageData || !mediaType) {
    sendJSON(res, 400, { error: 'imageData and mediaType are required' });
    return;
  }
  if (!hasSupportedMediaType(mediaType)) {
    sendJSON(res, 400, { error: 'mediaType must be a supported image type' });
    return;
  }

  let rawOcrText = '';
  try {
    rawOcrText = await runOnlineOcr(imageData, mediaType);
  } catch (err) {
    sendJSON(res, 422, { error: 'Online OCR failed', detail: err.message });
    return;
  }

  try {
    const structured = await structureWithHuggingFace(rawOcrText);
    sendJSON(res, 200, normalizeExtraction(structured, rawOcrText));
  } catch (err) {
    console.error('Hugging Face structuring failed:', err.message);
    sendJSON(res, 200, normalizeExtraction({}, rawOcrText));
  }
}

async function handleGenerateRecipe(req, res) {
  let body;
  try {
    body = await parseBody(req);
  } catch {
    sendJSON(res, 400, { error: 'Invalid request body' });
    return;
  }

  const brewer = brewers.find((item) => item.id === body.brewer_id);
  if (!brewer) {
    sendJSON(res, 400, { error: 'Unknown brewer_id' });
    return;
  }

  const batchSizeMl = Math.round(normalizeNumber(body.batch_size_ml, 250, { min: 30, max: 1500, decimals: 0 }));
  const flavorFocus = body.flavor_focus || 'balanced';
  const coffeeData = normalizeCoffeeData(body.coffee_data || {});

  try {
    const parsed = await generateRecipeWithHuggingFace({ coffeeData, brewer, batchSizeMl, flavorFocus });
    sendJSON(res, 200, normalizeGeneratedRecipe(parsed, brewer, batchSizeMl, flavorFocus));
  } catch (err) {
    console.error('Hugging Face recipe generation failed:', err.message);
    sendJSON(res, 503, {
      error: 'Online LLM recipe generation unavailable.',
      code: 'online_recipe_unavailable',
      detail: err.message,
    });
  }
}
const MIME = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
};

function serveStatic(req, res) {
  let urlPath = new URL(req.url, 'http://localhost').pathname;
  if (urlPath === '/') urlPath = '/index.html';
  const filePath = path.join(process.cwd(), 'dist', urlPath);
  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    res.end(fs.readFileSync(filePath));
    return true;
  }
  return false;
}

const server = http.createServer((req, res) => {
  if (req.method === 'OPTIONS') {
    sendJSON(res, 204, {});
    return;
  }
  if (req.method === 'POST' && req.url === '/extract') {
    handleExtract(req, res);
    return;
  }
  if (req.method === 'POST' && req.url === '/generate-recipe') {
    handleGenerateRecipe(req, res);
    return;
  }
  if (req.method === 'GET' && serveStatic(req, res)) {
    return;
  }
  sendJSON(res, 404, { error: 'Not found' });
});

server.on('error', (err) => {
  if (err?.code === 'EADDRINUSE') {
    console.warn(`Port ${PORT} is already in use. Another extract server may already be running.`);
    process.exit(0);
    return;
  }

  console.error('Extract server failed to start:', err);
  process.exit(1);
});

server.listen(PORT, () => {
  const chatProviders = getChatProviders();
  console.log(`Extract server listening on http://127.0.0.1:${PORT}`);
  console.log(`Using OCR.space OCR and LLM providers: ${describeChatProviders(chatProviders)}`);
  console.log(`Primary Hugging Face model: ${HF_MODEL}`);
});






