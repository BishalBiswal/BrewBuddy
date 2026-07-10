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
      <h2>{recipe.recipe_name || 'Your Recipe'}</h2>

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
        {recipe.recipe_style && (
          <div className="recipe-row">
            <span className="recipe-label">Style</span>
            <span className="recipe-value">{recipe.recipe_style}</span>
          </div>
        )}
        {recipe.difficulty && (
          <div className="recipe-row">
            <span className="recipe-label">Difficulty</span>
            <span className="recipe-value" style={{ textTransform: 'capitalize' }}>{recipe.difficulty}</span>
          </div>
        )}
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
          <span className="recipe-value">{recipe.water_temp_c || recipe.temperature} C</span>
        </div>
        <div className="recipe-row">
          <span className="recipe-label">Grind</span>
          <span className="recipe-value">
            {recipe.grind_relative || recipe.grind}
            {recipe.grind_grinder_setting ? ` (${recipe.grind_grinder_setting})` : ''}
          </span>
        </div>
        <div className="recipe-row">
          <span className="recipe-label">Brew Time</span>
          <span className="recipe-value">{formatTime(recipe.total_time_seconds || recipe.brew_time)}</span>
        </div>
        {recipe.target_tds != null && (
          <div className="recipe-row">
            <span className="recipe-label">Target TDS</span>
            <span className="recipe-value">{recipe.target_tds}%</span>
          </div>
        )}
        {recipe.target_extraction != null && (
          <div className="recipe-row">
            <span className="recipe-label">Extraction</span>
            <span className="recipe-value">{recipe.target_extraction}%</span>
          </div>
        )}
      </div>

      {recipe.expected_flavor && (
        <div className="recipe-notes" style={{ marginTop: '12px' }}>
          <h3>Expected Flavor</h3>
          <p>{recipe.expected_flavor}</p>
        </div>
      )}

      {recipe.brewing_philosophy && (
        <div className="recipe-notes">
          <h3>Brewing Philosophy</h3>
          <p>{recipe.brewing_philosophy}</p>
        </div>
      )}

      {recipe.why_this_recipe && (
        <div className="recipe-notes">
          <h3>Why This Recipe</h3>
          <p>{recipe.why_this_recipe}</p>
        </div>
      )}

      {steps.length > 0 && (
        <div className="recipe-steps">
          <h3>Brew Steps</h3>
          <ol className="steps-list">
            {steps.map((step, i) => {
              const startTime = step.start_time ?? step.time_sec ?? 0;
              const waterAmount = step.water > 0
                ? Math.round(recipe.water_g * step.water)
                : null;
              const stepName = step.name || step.label || `Step ${i + 1}`;
              return (
                <li key={i} className="step-item">
                  <span className="step-time">{formatTime(startTime)}</span>
                  <span className="step-label">{stepName}</span>
                  {step.pour_pattern && step.pour_pattern !== 'none' && (
                    <span className="step-instruction" style={{ color: 'var(--accent-light)', fontSize: '0.8rem' }}>
                      [{step.pour_pattern}]
                    </span>
                  )}
                  {step.agitation && step.agitation !== 'none' && (
                    <span className="step-instruction" style={{ color: 'var(--accent-light)', fontSize: '0.8rem' }}>
                      ({step.agitation})
                    </span>
                  )}
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

      {recipe.agitation && (
        <div className="recipe-notes">
          <h3>Agitation</h3>
          <p>{recipe.agitation}</p>
        </div>
      )}

      {recipe.dial_in_notes && (
        <div className="recipe-notes">
          <h3>Dial-In Notes</h3>
          <p>{recipe.dial_in_notes}</p>
        </div>
      )}

      {recipe.alternate_recipe && (
        <div className="recipe-notes">
          <h3>Alternative Recipe</h3>
          <p>{recipe.alternate_recipe}</p>
        </div>
      )}

      {recipe.avoid && (
        <div className="recipe-notes">
          <h3>What to Avoid</h3>
          <p>{recipe.avoid}</p>
        </div>
      )}

      {recipe.tips && (
        <div className="recipe-notes">
          <h3>Pro Tips</h3>
          <p>{recipe.tips}</p>
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
