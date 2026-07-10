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
  { value: 'other', label: 'Other' },
];

export default function PacketForm({ packet, onChange, onSubmit }) {
  const [visionError, setVisionError] = useState(null);

  const handleChange = (field) => (e) => {
    const value = field === 'tastingNotes'
      ? e.target.value.split(',').map(s => s.trim()).filter(Boolean)
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
    if (data.roast_level && ROAST_LEVELS.some(r => r.value === data.roast_level)) {
      updated.roastLevel = data.roast_level;
    }
    if (data.process && PROCESS_TYPES.some(p => p.value === data.process)) {
      updated.process = data.process;
    }
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
