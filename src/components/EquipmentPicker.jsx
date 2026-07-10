import React from 'react';
import brewers from '../data/brewers.json';
import grinders from '../data/grinders.json';
import GrinderCalibration from './GrinderCalibration';

function getBatchSizeMin(selectedBrewer) {
  return selectedBrewer === 'espresso' ? 15 : 50;
}

export default function EquipmentPicker({
  selectedBrewer,
  selectedGrinder,
  batchSizeMl,
  showCalibration,
  brewerSuggestions = [],
  onBrewerChange,
  onGrinderChange,
  onBatchSizeChange,
  onShowCalibration,
  onCalibrationSave,
  onBack,
  onSubmit,
}) {
  const batchSizeMin = getBatchSizeMin(selectedBrewer);

  const handleBrewerChange = (brewerId) => {
    onBrewerChange(brewerId);
    const nextMin = getBatchSizeMin(brewerId);
    if (batchSizeMl < nextMin) onBatchSizeChange(nextMin);
  };

  return (
    <div className="equipment-picker">
      <h2>Equipment & Batch</h2>

      {brewerSuggestions.length > 0 && (
        <div className="brewer-suggestions">
          <h3>Suggested Brew Methods</h3>
          <div className="brewer-suggestion-list">
            {brewerSuggestions.map((suggestion) => (
              <button
                key={suggestion.brewer_id}
                type="button"
                className={`brewer-suggestion ${selectedBrewer === suggestion.brewer_id ? 'active' : ''}`}
                onClick={() => handleBrewerChange(suggestion.brewer_id)}
              >
                <span className="brewer-suggestion-name">{suggestion.brewer_name || suggestion.brewer_id}</span>
                <span className="brewer-suggestion-note">{suggestion.rationale}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <label>
        Brew Method
        <select value={selectedBrewer || ''} onChange={(e) => handleBrewerChange(e.target.value)}>
          <option value="">- Select -</option>
          {brewers.map(b => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>

      <label>
        Batch Size (ml)
        <input
          type="number"
          min={batchSizeMin}
          max="2000"
          value={batchSizeMl}
          onChange={(e) => onBatchSizeChange(Math.max(batchSizeMin, Number(e.target.value)))}
        />
      </label>

      <label>
        Grinder
        <select value={selectedGrinder ? selectedGrinder.id : ''} onChange={(e) => {
          const id = e.target.value;
          if (id === 'custom') {
            onShowCalibration(true);
          } else {
            const grinder = grinders.find(g => g.id === id);
            onGrinderChange(grinder || null);
          }
        }}>
          <option value="">- Select -</option>
          {grinders.filter(g => g.id !== 'custom').map(g => (
            <option key={g.id} value={g.id}>{g.brand ? `${g.brand} ${g.model}` : g.model}</option>
          ))}
          <option value="custom">Custom / Calibrate...</option>
        </select>
      </label>

      {showCalibration && (
        <GrinderCalibration
          onSave={onCalibrationSave}
          onCancel={() => onShowCalibration(false)}
        />
      )}

      {selectedGrinder && selectedGrinder.id !== 'custom' && (
        <p className="grinder-info">
          {selectedGrinder.brand} {selectedGrinder.model} - {selectedGrinder.setting_type} setting: {selectedGrinder.min_setting}-{selectedGrinder.max_setting}
        </p>
      )}

      {selectedGrinder && selectedGrinder.id === 'custom' && selectedGrinder.calibrationFineSetting != null && (
        <p className="grinder-info">
          Custom calibration: fine={selectedGrinder.calibrationFineSetting} ({selectedGrinder.calibrationFineLabel}),
          coarse={selectedGrinder.calibrationCoarseSetting} ({selectedGrinder.calibrationCoarseLabel}),
          step={selectedGrinder.calibrationStepSize || 1}
        </p>
      )}

      <div className="button-row">
        <button className="btn-secondary" onClick={onBack}>Back</button>
        <button className="btn-primary" onClick={onSubmit} disabled={!selectedBrewer || !selectedGrinder}>
          Generate Recipe
        </button>
      </div>
    </div>
  );
}
