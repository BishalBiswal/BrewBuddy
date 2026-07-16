import { describe, it, expect } from 'vitest';
import { buildChatProvidersFromEnv, describeChatProviders, tryProviders } from '../../server/llm-providers.mjs';

describe('llm provider chain', () => {
  it('builds the balanced online provider chain in order', () => {
    const providers = buildChatProvidersFromEnv({
      HF_TOKEN: 'hf_token',
      GROQ_API_KEY: 'groq_token',
      TOGETHER_API_KEY: 'together_token',
      OPENROUTER_API_KEY: 'router_token',
    });

    expect(describeChatProviders(providers)).toBe('Hugging Face -> Groq -> Together -> OpenRouter');
    expect(providers.map((provider) => provider.model)).toEqual([
      'meta-llama/Llama-3.1-8B-Instruct:fastest',
      'llama-3.1-8b-instant',
      'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      'openrouter/free',
    ]);
  });

  it('retries until a later provider succeeds', async () => {
    const providers = [
      { displayName: 'First' },
      { displayName: 'Second' },
    ];

    const result = await tryProviders(providers, async (provider) => {
      if (provider.displayName === 'First') {
        const error = new Error('quota exhausted');
        error.status = 429;
        throw error;
      }

      return `${provider.displayName}-ok`;
    });

    expect(result.provider.displayName).toBe('Second');
    expect(result.result).toBe('Second-ok');
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0].message).toContain('quota exhausted');
  });
});
