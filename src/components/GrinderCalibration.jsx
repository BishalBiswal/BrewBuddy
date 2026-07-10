import React, { useState } from 'react';

export default function GrinderCalibration({ onSave, onCancel }) {
  const [fineSetting, setFineSetting] = useState('');
  const [fineLabel, setFineLabel] = useState('');
  const [coarseSetting, setCoarseSetting] = useState('');
  const [coarseLabel, setCoarseLabel] = useState('');
  const [stepSize, setStepSize] = useState('1');

  const handleSave = () => {
    const fine = Number(fineSetting);
    const coarse = Number(coarseSetting);
    const step = Number(stepSize);
    if (isNaN(fine) || isNaN(coarse) || fine === coarse) return;
    if (isNaN(step) || step <= 0) return;
    onSave({
      fineSetting: fine,
      fineLabel: fineLabel || 'Fine (espresso)',
      coarseSetting: coarse,
      coarseLabel: coarseLabel || 'Coarse (French press)',
      stepSize: step,
    });
  };

  return (
    <div className="grinder-calibration">
      <h3>2-Point Grinder Calibration</h3>
      <p className="help-text">Enter two known reference points for your grinder.</p>

      <div className="calibration-point">
        <strong>Point 1 - Fine</strong>
        <label>
          Setting
          <input type="number" value={fineSetting} onChange={(e) => setFineSetting(e.target.value)} placeholder="e.g. 8" />
        </label>
        <label>
          Label (optional)
          <input type="text" value={fineLabel} onChange={(e) => setFineLabel(e.target.value)} placeholder="e.g. Espresso fine" />
        </label>
      </div>

      <div className="calibration-point">
        <strong>Point 2 - Coarse</strong>
        <label>
          Setting
          <input type="number" value={coarseSetting} onChange={(e) => setCoarseSetting(e.target.value)} placeholder="e.g. 32" />
        </label>
        <label>
          Label (optional)
          <input type="text" value={coarseLabel} onChange={(e) => setCoarseLabel(e.target.value)} placeholder="e.g. French press coarse" />
        </label>
      </div>

      <label className="step-size-label">
        Step Size (default: 1)
        <input type="number" min="0.1" step="0.1" value={stepSize} onChange={(e) => setStepSize(e.target.value)} placeholder="e.g. 1" />
      </label>

      <div className="button-row">
        <button className="btn-secondary" onClick={onCancel}>Cancel</button>
        <button className="btn-primary" onClick={handleSave} disabled={!fineSetting || !coarseSetting || Number(stepSize) <= 0}>
          Save Calibration
        </button>
      </div>
    </div>
  );
}
