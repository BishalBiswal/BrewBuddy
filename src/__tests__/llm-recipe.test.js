import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { generateRecipeFromLLM } from '../engine/llm-recipe';

describe('generateRecipeFromLLM', () => {
  const mockPayload = {
    coffee_data: { roast_level: 'light', process: 'washed', tasting_notes: ['floral'] },
    brewer_id: 'v60',
    batch_size_ml: 250,
    flavor_focus: 'balanced',
  };

  beforeEach(() => {
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON on success', async () => {
    const mockResponse = {
      recipe: { brewer_id: 'v60', ratio: 15, dose_g: 16.7 },
      rationale: 'A good recipe.',
      suggestions: [],
    };
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await generateRecipeFromLLM(mockPayload);
    expect(result).toEqual(mockResponse);
    expect(globalThis.fetch).toHaveBeenCalledWith('/generate-recipe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(mockPayload),
    });
  });

  it('throws with status and error detail on HTTP error', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 503,
      json: () => Promise.resolve({ error: 'LLM recipe generation failed', detail: 'Model overloaded' }),
    });

    await expect(generateRecipeFromLLM(mockPayload)).rejects.toThrow('Model overloaded');
  });

  it('throws with HTTP status when no JSON body', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.reject(new Error('Not JSON')),
    });

    await expect(generateRecipeFromLLM(mockPayload)).rejects.toThrow('HTTP 400');
  });

  it('throws on network error', async () => {
    globalThis.fetch.mockRejectedValue(new Error('Network failure'));

    await expect(generateRecipeFromLLM(mockPayload)).rejects.toThrow('Network failure');
  });

  it('sets status and data on error object', async () => {
    const errData = { error: 'Bad request', detail: 'Missing field' };
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 400,
      json: () => Promise.resolve(errData),
    });

    try {
      await generateRecipeFromLLM(mockPayload);
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(err.status).toBe(400);
      expect(err.data).toEqual(errData);
    }
  });
});
