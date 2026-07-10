import React, { useState } from 'react';
import VisionUpload from './VisionUpload';

const ROAST_LEVELS = [
  { value: 'light', label: 'Light' },
  { value: 'light-medium', label: 'Light-Medium' },
  { value: 'medium', label: 'Medium' },
  { value: 'medium-dark', label: 'Medium-Dark' },
  { value: 'dark', label: 'Dark' },
  { value: 'espresso_blend', label: 'Espresso Blend' },
];

const PROCESS_TYPES = [
  { value: 'washed', label: 'Washed' },
  { value: 'natural', label: 'Natural' },
  { value: 'honey', label: 'Honey' },
  { value: 'semi-washed', label: 'Semi-Washed' },
  { value: 'wet-hulled', label: 'Wet-Hulled' },
  { value: 'anaerobic', label: 'Anaerobic' },
  { value: 'carbonic_maceration', label: 'Carbonic Maceration' },
  { value: 'coferment', label: 'Co-Ferment' },
  { value: 'lactic', label: 'Lactic' },
  { value: 'thermal_shock', label: 'Thermal Shock' },
  { value: 'other', label: 'Other' },
];

const VARIETY_OPTIONS = [
  { value: '', label: '- Select -' },
  { value: 'gesha', label: 'Gesha / Geisha' },
  { value: 'bourbon', label: 'Bourbon' },
  { value: 'typica', label: 'Typica' },
  { value: 'caturra', label: 'Caturra' },
  { value: 'catuai', label: 'Catuai' },
  { value: 'sl28', label: 'SL28' },
  { value: 'sl34', label: 'SL34' },
  { value: 'pacamara', label: 'Pacamara' },
  { value: 'mokka', label: 'Mokka / Mokha' },
  { value: 'maragogype', label: 'Maragogype / Maragogipe' },
  { value: 'mundonovo', label: 'Mundo Novo' },
  { value: 'castillo', label: 'Castillo' },
  { value: 'colombia', label: 'Colombia' },
  { value: 'tupi', label: 'Tupi' },
  { value: 'icatu', label: 'Icatu' },
  { value: 'rubi', label: 'Rubi' },
  { value: 'java', label: 'Java' },
  { value: 'mayor', label: 'Mayor' },
  { value: 'laurina', label: 'Laurina' },
  { value: 'eugenioides', label: 'Eugenioides' },
  { value: 'sidra', label: 'Sidra' },
  { value: 'chiroso', label: 'Chiroso' },
  { value: 'tabi', label: 'Tabi' },
  { value: 'rume_sudan', label: 'Rume Sudan' },
  { value: 'wush_wush', label: 'Wush Wush' },
  { value: 'landrace', label: 'Landrace / Heirloom' },
  { value: 'liberica', label: 'Liberica' },
];

const KNOWN_VARIETY_KEYS = VARIETY_OPTIONS.map(v => v.value).filter(Boolean);

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

function fuzzyVariety(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const v = raw.toLowerCase().trim().replace(/[\s_-]+/g, '');
  let best = null, bestDist = Infinity;
  for (const key of KNOWN_VARIETY_KEYS) {
    const k = key.toLowerCase().replace(/[\s_-]+/g, '');
    const dist = levenshtein(v, k);
    const threshold = Math.max(2, Math.floor(Math.min(v.length, k.length) / 3));
    if (dist <= threshold && dist < bestDist) { best = key; bestDist = dist; }
  }
  return best;
}

const ROAST_ALIASES = {
  'light': 'light', 'light-medium': 'light-medium', 'medium': 'medium',
  'medium-dark': 'medium-dark', 'dark': 'dark', 'espresso_blend': 'espresso_blend',
  'espresso': 'espresso_blend',
};

const PROCESS_ALIASES = {
  'washed': 'washed', 'natural': 'natural', 'honey': 'honey',
  'semi-washed': 'semi-washed', 'wet-hulled': 'wet-hulled',
  'anaerobic': 'anaerobic', 'carbonic_maceration': 'carbonic_maceration',
  'carbonic': 'carbonic_maceration', 'coferment': 'coferment',
  'co-ferment': 'coferment', 'lactic': 'lactic',
  'thermal_shock': 'thermal_shock', 'thermal shock': 'thermal_shock',
};

function matchEnum(raw, aliases) {
  if (!raw || typeof raw !== 'string') return null;
  const v = raw.toLowerCase().trim();
  return aliases[v] || null;
}

function matchVariety(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const v = raw.toLowerCase().trim();
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
  return fuzzyVariety(raw);
}

export default function PacketForm({ packet, onChange, onSubmit, brewerSuggestions }) {
  const [visionError, setVisionError] = useState(null);

  const handleChange = (field) => (e) => {
    const value = field === 'tastingNotes'
      ? e.target.value.split(',').map(s => s.trim())
      : e.target.value;
    onChange({ ...packet, [field]: value });
  };

  const handleExtracted = (data) => {
    setVisionError(null);
    const updated = { ...packet };
    if (data.roaster) updated.roaster = data.roaster;
    if (data.coffee_name) updated.coffeeName = data.coffee_name;
    if (data.origin_country) updated.originCountry = data.origin_country;
    if (data.region) updated.region = data.region;
    const normRoast = matchEnum(data.roast_level, ROAST_ALIASES);
    if (normRoast) updated.roastLevel = normRoast;
    const normProcess = matchEnum(data.process, PROCESS_ALIASES);
    if (normProcess) updated.process = normProcess;
    const normVariety = matchVariety(data.variety);
    if (normVariety) updated.variety = normVariety;
    if (data.tasting_notes && data.tasting_notes.length > 0) {
      updated.tastingNotes = data.tasting_notes;
    }
    if (data.altitude_m != null) updated.altitudeM = data.altitude_m;
    if (data.roast_date) updated.roastDate = data.roast_date;
    onChange(updated);
  };

  const handleVisionError = (msg) => {
    setVisionError(msg || 'Extraction failed. Please enter details manually.');
  };

  return (
    <form className="packet-form" onSubmit={(e) => { e.preventDefault(); onSubmit(); }}>
      <h2>Coffee Details</h2>

      <VisionUpload onExtracted={handleExtracted} onError={handleVisionError} />

      {visionError && (
        <p className="vision-error">{visionError}</p>
      )}

      <label>
        Coffee Name
        <input type="text" value={packet.coffeeName} onChange={handleChange('coffeeName')} placeholder="e.g. Yirgacheffe" />
      </label>

      <label>
        Roaster
        <input type="text" value={packet.roaster} onChange={handleChange('roaster')} placeholder="e.g. Onyx Coffee Lab" />
      </label>

      <div className="row">
        <label>
          Origin Country
          <input type="text" value={packet.originCountry} onChange={handleChange('originCountry')} placeholder="e.g. Ethiopia" />
        </label>
        <label>
          Region
          <input type="text" value={packet.region} onChange={handleChange('region')} placeholder="e.g. Yirgacheffe" />
        </label>
      </div>

      <label>
        Roast Level
        <select value={packet.roastLevel} onChange={handleChange('roastLevel')}>
          <option value="">- Select -</option>
          {ROAST_LEVELS.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </label>

      <label>
        Process
        <select value={packet.process} onChange={handleChange('process')}>
          <option value="">- Select -</option>
          {PROCESS_TYPES.map(p => (
            <option key={p.value} value={p.value}>{p.label}</option>
          ))}
        </select>
      </label>

      <label>
        Variety
        <select value={packet.variety || ''} onChange={handleChange('variety')}>
          {VARIETY_OPTIONS.map(v => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
      </label>

      <label>
        Tasting Notes (comma separated)
        <input type="text" value={packet.tastingNotes.join(', ')} onChange={handleChange('tastingNotes')} placeholder="e.g. floral, citrus, bergamot" />
      </label>

      <div className="row">
        <label>
          Altitude (m)
          <input type="number" value={packet.altitudeM || ''} onChange={(e) => onChange({ ...packet, altitudeM: e.target.value ? Number(e.target.value) : null })} placeholder="e.g. 1800" />
        </label>
        <label>
          Roast Date
          <input type="date" value={packet.roastDate || ''} onChange={handleChange('roastDate')} />
        </label>
      </div>

      <button type="submit" className="btn-primary">Continue to Equipment</button>
    </form>
  );
}
