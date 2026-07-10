import React from 'react';
import brewRules from '../data/brew_rules.json';

const adjustments = brewRules.flavor_focus_adjustments;

export default function FlavorFocusPicker({ selected, onChange, onBack, onSubmit, isSubmitting = false }) {
  return (
    <div className="flavor-focus-picker">
      <h2>Flavor Focus</h2>
      <p className="help-text">How would you like to tune this brew?</p>

      <div className="flavor-options">
        {Object.entries(adjustments).map(([key, adj]) => (
          <button
            key={key}
            className={`flavor-option ${selected === key ? 'active' : ''}`}
            onClick={() => onChange(key)}
            disabled={isSubmitting}
          >
            <strong>{adj.label}</strong>
            <span className="flavor-desc">{adj.description}</span>
          </button>
        ))}
      </div>

      <div className="button-row">
        <button className="btn-secondary" onClick={onBack} disabled={isSubmitting}>Back</button>
        <button className="btn-primary" onClick={onSubmit} disabled={!selected || isSubmitting}>
          {isSubmitting ? 'Generating...' : 'Show Recipe'}
        </button>
      </div>
    </div>
  );
}
