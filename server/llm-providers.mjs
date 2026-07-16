function firstDefined(...values) {
  for (const value of values) {
    if (value != null && value !== '') return value;
  }
  return '';
}

function toBool(value, defaultValue = false) {
  if (value == null || value === '') return defaultValue;
  const normalized = String(value).toLowerCase().trim();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
  return defaultValue;
}

function extractContent(data) {
  return data?.choices?.[0]?.message?.content
    ?? data?.generated_text
    ?? data?.message?.content
    ?? data?.response
    ?? data?.output
    ?? data?.content
    ?? data?.[0]?.generated_text
    ?? '';
}

function truncateDetail(text, max = 240) {
  const value = String(text || '').trim();
  return value.length > max ? `${value.slice(0, max)}...` : value;
}

function createOpenAICompatibleProvider({
  name,
  displayName,
  enabled,
  url,
  model,
  apiKey,
}) {
  return {
    name,
    displayName: displayName || name,
    enabled: Boolean(enabled),
    url,
    model,
    kind: 'openai-compatible',
    async call(messages, { temperature = 0, maxTokens = 700, responseFormat = null } = {}) {
      if (!url) throw new Error(`${displayName || name} URL is not configured`);

      const body = {
        model,
        stream: false,
        messages,
        temperature,
        max_tokens: maxTokens,
      };

      if (responseFormat) {
        body.response_format = responseFormat;
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const detail = await response.text().catch(() => '');
        const error = new Error(`${displayName || name} returned ${response.status}${detail ? `: ${truncateDetail(detail)}` : ''}`);
        error.status = response.status;
        error.detail = detail;
        throw error;
      }

      const data = await response.json();
      const content = extractContent(data);
      if (!content) {
        throw new Error(`${displayName || name} returned empty content`);
      }
      return content;
    },
  };
}

export function buildChatProvidersFromEnv(env = process.env) {
  const hfToken = firstDefined(env.HF_TOKEN, env.HUGGINGFACE_API_TOKEN);
  return [
    createOpenAICompatibleProvider({
      name: 'huggingface',
      displayName: 'Hugging Face',
      enabled: Boolean(hfToken),
      url: env.HF_CHAT_URL || 'https://router.huggingface.co/v1/chat/completions',
      model: env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct:fastest',
      apiKey: hfToken,
    }),
    createOpenAICompatibleProvider({
      name: 'groq',
      displayName: 'Groq',
      enabled: Boolean(env.GROQ_API_KEY),
      url: env.GROQ_CHAT_URL || 'https://api.groq.com/openai/v1/chat/completions',
      model: env.GROQ_MODEL || 'llama-3.1-8b-instant',
      apiKey: env.GROQ_API_KEY || '',
    }),
    createOpenAICompatibleProvider({
      name: 'together',
      displayName: 'Together',
      enabled: Boolean(env.TOGETHER_API_KEY),
      url: env.TOGETHER_CHAT_URL || 'https://api.together.xyz/v1/chat/completions',
      model: env.TOGETHER_MODEL || 'meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo',
      apiKey: env.TOGETHER_API_KEY || '',
    }),
    createOpenAICompatibleProvider({
      name: 'openrouter',
      displayName: 'OpenRouter',
      enabled: Boolean(env.OPENROUTER_API_KEY),
      url: env.OPENROUTER_CHAT_URL || 'https://openrouter.ai/api/v1/chat/completions',
      model: env.OPENROUTER_MODEL || 'openrouter/free',
      apiKey: env.OPENROUTER_API_KEY || '',
    }),
  ].filter((provider) => provider.enabled);
}

export function describeChatProviders(providers) {
  if (!providers || providers.length === 0) return 'none';
  return providers.map((provider) => provider.displayName || provider.name).join(' -> ');
}

export async function tryProviders(providers, executor) {
  const failures = [];

  for (const provider of providers || []) {
    try {
      const result = await executor(provider);
      return { provider, result, failures };
    } catch (error) {
      failures.push({
        provider: provider.displayName || provider.name,
        message: error?.message || 'Unknown error',
        status: error?.status ?? null,
      });
    }
  }

  const error = new Error(failures.map((failure) => failure.message).join(' | ') || 'No providers were available');
  error.failures = failures;
  throw error;
}

