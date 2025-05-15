// Defines the AI models available for chat and title generation.

export const ALL_AVAILABLE_MODELS = [
  // Google Models (Chat & Title)
  {
    id: 'google/gemini-1.5-flash', // Our unique identifier
    name: 'Gemini 1.5 Flash (Google)',
    provider: 'google',
    sdkId: 'models/gemini-1.5-flash-latest', // ID for Vercel AI SDK
    usage: ['chat', 'title'],
    defaultFor: ['chat'] // Indicates this is a default model for chat
  },
  // Add other specific Gemini models here if needed, e.g., gemini-pro (non-flash/pro versions)

  // OpenRouter Models (Chat & Title)
  {
    id: 'openrouter/deepseek-prover-v2',
    name: 'DeepSeek Prover V2 (OpenRouter)',
    provider: 'openrouter',
    sdkId: 'deepseek/deepseek-prover-v2:free',
    usage: ['chat', 'title'], // Assuming it can be used for chat too, adjust if only title
    defaultFor: ['title'] // Indicates this is a default model for title generation
  },
  {
    id: 'openrouter/llama-4-maverick',
    name: 'Llama 4 Maverick (OpenRouter)',
    provider: 'openrouter',
    sdkId: 'meta-llama/llama-4-maverick:free',
    usage: ['chat', 'title']
  },
  {
    id: 'openrouter/qwen3-30b-a3b',
    name: 'Qwen3 30B A3B (OpenRouter)',
    provider: 'openrouter',
    sdkId: 'qwen/qwen3-30b-a3b:free',
    usage: ['chat', 'title']
  },
  {
    id: 'openrouter/deepseek-v3-base',
    name: 'DeepSeek V3 Base (OpenRouter)',
    provider: 'openrouter',
    sdkId: 'deepseek/deepseek-v3-base:free',
    usage: ['chat', 'title']
  },

  {
    id: 'openrouter/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B Instruct (OpenRouter)',
    provider: 'openrouter',
    sdkId: 'meta-llama/llama-3.3-70b-instruct:free',
    usage: ['chat', 'title']
  },
  // Potentially other OpenRouter models as needed
];

// Helper function to get default model for a specific usage (chat or title)
export function getDefaultModelForUsage(usageType) {
  const model = ALL_AVAILABLE_MODELS.find(m => m.defaultFor && m.defaultFor.includes(usageType));
  if (!model) {
    // Fallback if no explicit default is set for a type (should not happen with current setup)
    console.warn(`No default model explicitly set for usage type: ${usageType}. Falling back to first available model for that type or generic default.`);
    const fallback = ALL_AVAILABLE_MODELS.find(m => m.usage.includes(usageType));
    if (fallback) return fallback.id;
    // Absolute fallback (e.g. if usageType is invalid or no models for it)
    return ALL_AVAILABLE_MODELS[0].id; 
  }
  return model.id;
}

// Helper function to get model config by its unique ID
export function getModelConfigById(id) {
  return ALL_AVAILABLE_MODELS.find(m => m.id === id);
} 