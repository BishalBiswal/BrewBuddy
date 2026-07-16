export async function generateRecipeFromLLM(payload) {
  const response = await fetch('/generate-recipe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data?.detail || data?.error || `HTTP ${response.status}`;
    const err = new Error(message);
    err.status = response.status;
    err.data = data;
    throw err;
  }
  if (!data?.recipe) {
    throw new Error('Recipe generation returned no recipe');
  }
  return {
    recipe: data.recipe,
    rationale: data.rationale || '',
    suggestions: Array.isArray(data.suggestions) ? data.suggestions : [],
  };
}

export async function generateRecipeLLM({ packet, brewerId, batchSizeMl, flavorFocus }) {
  return generateRecipeFromLLM({
    coffee_data: packet,
    brewer_id: brewerId,
    batch_size_ml: batchSizeMl,
    flavor_focus: flavorFocus,
  });
}


