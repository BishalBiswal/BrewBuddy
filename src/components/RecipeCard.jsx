import React from 'react';

function formatTime(sec) {
  if (sec >= 60) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }
  return `${sec}s`;
}

export default function RecipeCard({ recipe, rationale, suggestions, warning, onBack, onReset }) {
  const steps = recipe.brew_steps || [];

  return (
    <div className="recipe-card">
      <h2>Your Recipe</h2>

      {warning && <p className="recipe-warning">{warning}</p>}

      {suggestions && suggestions.length > 0 && (
        <div className="recipe-suggestions">
          <h3>Suggested Brew Methods</h3>
          <ul>
            {suggestions.map((s, i) => (
              <li key={i}><strong>{s.brewer_name || s.brewer_id}</strong>: {s.rationale}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="recipe-details">
        <div className="recipe-row">
          <span className="recipe-label">Brewer</span>
          <span className="recipe-value">{recipe.brewer_name}</span>
        </div>
        <div className="recipe-row">
          <span className="recipe-label">Flavor Focus</span>
          <span className="recipe-value">{recipe.flavor_focus_label}</span>
        </div>
        <div className="recipe-row">
          <span className="recipe-label">Ratio</span>
          <span className="recipe-value">1:{recipe.ratio}</span>
        </div>
        <div className="recipe-row">
          <span className="recipe-label">Dose</span>
          <span className="recipe-value">{recipe.dose_g}g coffee</span>
        </div>
        <div className="recipe-row">
          <span className="recipe-label">Water</span>
          <span className="recipe-value">{recipe.water_g}g water</span>
        </div>
        <div className="recipe-row">
          <span className="recipe-label">Water Temp</span>
          <span className="recipe-value">{recipe.water_temp_c} C</span>
        </div>
        <div className="recipe-row">
          <span className="recipe-label">Grind</span>
          <span className="recipe-value">
            {recipe.grind_relative}
            {recipe.grind_grinder_setting ? ` (${recipe.grind_grinder_setting})` : ''}
          </span>
        </div>
        <div className="recipe-row">
          <span className="recipe-label">Brew Time</span>
          <span className="recipe-value">{formatTime(recipe.total_time_seconds)}</span>
        </div>
      </div>

      {steps.length > 0 && (
        <div className="recipe-steps">
          <h3>Brew Steps</h3>
          <ol className="steps-list">
            {steps.map((step, i) => {
              const waterAmount = step.water_fraction > 0
                ? Math.round(recipe.water_g * step.water_fraction)
                : null;
              return (
                <li key={i} className="step-item">
                  <span className="step-time">{formatTime(step.time_sec)}</span>
                  <span className="step-label">{step.label}</span>
                  <span className="step-instruction">{step.instruction}</span>
                  {waterAmount != null && (
                    <span className="step-water">{waterAmount}g water</span>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {recipe.technique_notes && (
        <div className="recipe-notes">
          <h3>Technique</h3>
          <p>{recipe.technique_notes}</p>
        </div>
      )}

      {rationale && (
        <div className="recipe-rationale">
          <h3>Why This Recipe</h3>
          <p>{rationale}</p>
        </div>
      )}

      <div className="button-row">
        <button className="btn-secondary" onClick={onBack}>Adjust</button>
        <button className="btn-secondary" onClick={onReset}>Start Over</button>
      </div>
    </div>
  );
}
