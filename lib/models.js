// Defines the AI models available for chat and title generation.

export const ALL_AVAILABLE_MODELS = [
  // Google Models (Chat & Title)
  {
    id: 'google/gemini-1.5-flash',
    name: 'Gemini 1.5 Flash (Google)',
    provider: 'google',
    sdkId: 'models/gemini-1.5-flash-latest', // Vercel AI SDK uses -latest for this one
    usage: ['chat', 'title'],
    defaultFor: ['chat']
  },
  {
    id: 'google/gemini-1.5-pro',
    name: 'Gemini 1.5 Pro (Google)',
    provider: 'google',
    sdkId: 'models/gemini-1.5-pro-latest', // Vercel AI SDK uses -latest for this one
    usage: ['chat', 'title'] // Also good for titles if needed
  },
  {
    id: 'google/gemini-2.0-flash',
    name: 'Gemini 2.0 Flash (Google)',
    provider: 'google',
    sdkId: 'models/gemini-2.0-flash',
    usage: ['chat', 'title']
  },
  {
    id: 'google/gemini-2.5-flash-preview',
    name: 'Gemini 2.5 Flash Preview (Google)',
    provider: 'google',
    sdkId: 'models/gemini-2.5-flash-preview-04-17',
    usage: ['chat', 'title']
  },
  {
    id: 'google/gemini-2.5-pro-preview',
    name: 'Gemini 2.5 Pro Preview (Google)',
    provider: 'google',
    sdkId: 'models/gemini-2.5-pro-preview-05-06',
    usage: ['chat', 'title']
  },

  // OpenRouter Models (Chat & Title)
  {
    id: 'openrouter/deepseek-prover-v2',
    name: 'DeepSeek Prover V2 (OpenRouter)',
    provider: 'openrouter',
    sdkId: 'deepseek/deepseek-prover-v2:free',
    usage: ['chat', 'title'],
    defaultFor: ['title']
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
];

// Helper function to get default model for a specific usage (chat or title)
export function getDefaultModelForUsage(usageType) {
  const model = ALL_AVAILABLE_MODELS.find(m => m.defaultFor && m.defaultFor.includes(usageType));
  if (!model) {
    console.warn(`No default model explicitly set for usage type: ${usageType}. Falling back to first available model for that type or generic default.`);
    const fallback = ALL_AVAILABLE_MODELS.find(m => m.usage.includes(usageType));
    if (fallback) return fallback.id;
    return ALL_AVAILABLE_MODELS[0].id; 
  }
  return model.id;
}

// Helper function to get model config by its unique ID
export function getModelConfigById(id) {
  return ALL_AVAILABLE_MODELS.find(m => m.id === id);
} 