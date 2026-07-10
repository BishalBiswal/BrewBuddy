import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
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
    if (key && !process.env[key]) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env'));
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const PORT = process.env.EXTRACT_PORT || 3001;
const OCR_SPACE_API_KEY = process.env.OCR_SPACE_API_KEY || 'helloworld';
const OCR_SPACE_URL = process.env.OCR_SPACE_URL || 'https://api.ocr.space/parse/image';
const HF_TOKEN = process.env.HF_TOKEN || process.env.HUGGINGFACE_API_TOKEN || '';
const HF_MODEL = process.env.HF_MODEL || 'meta-llama/Llama-3.3-70B-Instruct:fastest';
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
- process must be one of: washed, natural, honey, semi-washed, wet-hulled, or null.
- roast_date must be YYYY-MM-DD if clear, otherwise null.
- Do not invent facts that are not present in the OCR text.
- No prose. No markdown fences.

OCR text:
${rawOcrText}`;
}

async function callHuggingFace(messages, { temperature = 0, maxTokens = 700 } = {}) {
  if (!HF_TOKEN) {
    throw new Error('HF_TOKEN is not configured');
  }

  const response = await fetch(HF_CHAT_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${HF_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: HF_MODEL,
      stream: false,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`Hugging Face returned ${response.status}${detail ? `: ${detail}` : ''}`);
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || data.generated_text || data[0]?.generated_text || '';
}

async function structureWithHuggingFace(rawOcrText) {
  const text = await callHuggingFace([
    { role: 'system', content: 'Return only strict JSON. No prose. No markdown.' },
    { role: 'user', content: buildPrompt(rawOcrText) },
  ], { temperature: 0, maxTokens: 700 });
  return extractJson(text);
}

function normalizeCoffeeData(input = {}) {
  return {
    coffeeName: input.coffeeName || input.coffee_name || '',
    roaster: input.roaster || '',
    originCountry: input.originCountry || input.origin_country || '',
    region: input.region || '',
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
    label: typeof step?.label === 'string' && step.label.trim() ? step.label.trim() : `Step ${index + 1}`,
    time_sec: Math.max(0, Math.round(Number(step?.time_sec) || 0)),
    duration_sec: Math.max(0, Math.round(Number(step?.duration_sec) || 0)),
    water_fraction: normalizeNumber(step?.water_fraction, fallbackWaterFraction, { min: 0, max: 1, decimals: 3 }),
    instruction: typeof step?.instruction === 'string' && step.instruction.trim() ? step.instruction.trim() : 'Follow the method-specific technique for this step.',
  };
}

function normalizeGeneratedRecipe(parsed, brewer, batchSizeMl, flavorFocus) {
  const recipe = parsed?.recipe || parsed || {};
  const flavorAdj = brewRules.flavor_focus_adjustments?.[flavorFocus] || brewRules.flavor_focus_adjustments?.balanced || { label: flavorFocus };
  const base = brewer.base_recipe;
  const ratio = normalizeNumber(recipe.ratio, base.ratio, { min: 1.5, max: 20, decimals: 1 });
  const waterG = Math.round(normalizeNumber(recipe.water_g, batchSizeMl, { min: 30, max: 1500, decimals: 0 }));
  const doseG = normalizeNumber(recipe.dose_g, waterG / ratio, { min: 1, max: 200, decimals: 1 });
  const grind = RECIPE_GRIND_LEVELS.includes(recipe.grind_relative) ? recipe.grind_relative : base.grind_relative;
  const rawSteps = Array.isArray(recipe.brew_steps) && recipe.brew_steps.length ? recipe.brew_steps : brewer.brew_steps;
  const fallbackFraction = rawSteps.length ? 1 / rawSteps.length : 0;

  return {
    recipe: {
      brewer_id: brewer.id,
      brewer_name: brewer.name,
      flavor_focus: flavorFocus,
      flavor_focus_label: recipe.flavor_focus_label || flavorAdj.label || flavorFocus,
      ratio,
      dose_g: doseG,
      water_g: waterG,
      water_temp_c: normalizeNumber(recipe.water_temp_c ?? recipe.temp_c, base.temp_c, { min: 75, max: 100, decimals: 1 }),
      grind_relative: grind,
      grind_grinder_setting: recipe.grind_grinder_setting || null,
      total_time_seconds: Math.max(15, Math.round(Number(recipe.total_time_seconds) || base.total_time_seconds)),
      technique_notes: typeof recipe.technique_notes === 'string' && recipe.technique_notes.trim() ? recipe.technique_notes.trim() : brewer.technique_notes,
      brew_steps: rawSteps.map((step, index) => normalizeStep(step, index, fallbackFraction)),
    },
    rationale: typeof parsed?.rationale === 'string' ? parsed.rationale.trim() : '',
    suggestions: Array.isArray(parsed?.suggestions) ? parsed.suggestions.map((suggestion) => ({
      brewer_id: suggestion.brewer_id || null,
      brewer_name: suggestion.brewer_name || suggestion.name || suggestion.brewer_id || 'Alternative',
      rationale: suggestion.rationale || '',
    })).filter((suggestion) => suggestion.rationale) : [],
  };
}

function buildRecipePrompt({ coffeeData, brewer, batchSizeMl, flavorFocus }) {
  const flavorAdj = brewRules.flavor_focus_adjustments?.[flavorFocus] || brewRules.flavor_focus_adjustments?.balanced;
  const otherBrewers = brewers.filter((b) => b.id !== brewer.id).map((b) => ({ id: b.id, name: b.name, category: b.category }));
  return `Generate a coffee brewing recipe as strict JSON. Return ONLY JSON, no markdown.

Coffee data from the scanned/manual bag fields:
${JSON.stringify(coffeeData, null, 2)}

Selected brew method guardrail:
${JSON.stringify({
  id: brewer.id,
  name: brewer.name,
  category: brewer.category,
  default_ratio_range: brewer.default_ratio_range,
  default_temp_range: brewer.default_temp_range,
  base_recipe: brewer.base_recipe,
  existing_steps_are_only_a_reference: brewer.brew_steps,
}, null, 2)}

User choices:
${JSON.stringify({ batch_size_ml: batchSizeMl, flavor_focus: flavorFocus, flavor_focus_rule: flavorAdj }, null, 2)}

Available alternative methods:
${JSON.stringify(otherBrewers, null, 2)}

Output schema:
{
  "recipe": {
    "brewer_id": "${brewer.id}",
    "brewer_name": "${brewer.name}",
    "flavor_focus": "${flavorFocus}",
    "flavor_focus_label": "string",
    "ratio": number,
    "dose_g": number,
    "water_g": number,
    "water_temp_c": number,
    "grind_relative": "one of ${RECIPE_GRIND_LEVELS.join(', ')}",
    "grind_grinder_setting": null,
    "total_time_seconds": number,
    "technique_notes": "string",
    "brew_steps": [
      { "type": "pour|steep|action|drawdown", "label": "string", "time_sec": number, "duration_sec": number, "water_fraction": number, "instruction": "string" }
    ]
  },
  "rationale": "string",
  "suggestions": [
    { "brewer_id": "string", "brewer_name": "string", "rationale": "string" }
  ]
}

Rules:
- Make the recipe specific to roast level, process, altitude, and tasting notes. For fruity/anaerobic/honey coffees, preserve fruit clarity and sweetness unless the flavor focus says otherwise.
- Include exact pours or stages. For pour-over methods, brew_steps must have bloom plus at least two named pours with water_fraction values that sum close to 1.0.
- dose_g must match water_g / ratio. water_g should equal the requested batch size.
- Respect the selected brewer's practical ratio/temp ranges unless the coffee strongly justifies a small deviation.
- Suggestions must recommend 2 or 3 different methods and explain why they fit this coffee.
- Do not claim facts not present in the coffee data.`;
}

async function generateRecipeWithHuggingFace(payload) {
  const text = await callHuggingFace([
    { role: 'system', content: 'You are a coffee brewing expert. Return only strict JSON matching the requested schema.' },
    { role: 'user', content: buildRecipePrompt(payload) },
  ], { temperature: 0.55, maxTokens: 1500 });
  return extractJson(text);
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
    sendJSON(res, 503, {
      error: 'Free online LLM unavailable or not configured. Set HF_TOKEN for Hugging Face Inference Providers.',
      code: 'online_llm_unavailable',
      detail: err.message,
      raw_ocr_text: rawOcrText,
    });
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
      error: 'Free online LLM recipe generation unavailable or not configured.',
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

server.listen(PORT, () => {
  console.log(`Extract server listening on http://127.0.0.1:${PORT}`);
  console.log(`Using OCR.space OCR and Hugging Face model ${HF_MODEL}`);
  console.log(`HF_TOKEN configured: ${HF_TOKEN ? 'yes' : 'no'}`);
});
