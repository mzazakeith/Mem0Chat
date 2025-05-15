import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { ALL_AVAILABLE_MODELS, getDefaultModelForUsage, getModelConfigById } from '../../../lib/models';

export const dynamic = 'force-dynamic';

// Initialize OpenRouter provider - this will be done dynamically now
// const openrouter = createOpenRouter({
//   apiKey: process.env.OPENROUTER_API_KEY,
// });

export async function POST(req) {
  try {
    const { messageContent, modelId: requestedModelId } = await req.json();

    if (!messageContent) {
      return new Response(JSON.stringify({ error: 'messageContent is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const prompt = `Generate a very short, concise title (max 3 words) for a chat conversation that starts with this message: "${messageContent}". The title should be suitable for a chat list. Do not add quotes around the title. Return only the title, no other text or comments or punctuation. Should not be in markdown. Just plain text of the title`;

    // Model selection logic
    let modelInstance;
    const modelIdToUse = requestedModelId || getDefaultModelForUsage('title');
    const modelConfig = getModelConfigById(modelIdToUse);

    if (!modelConfig) {
      console.error(`[Title API] Error: Model configuration not found for ID: ${modelIdToUse}`);
      return new Response(JSON.stringify({ error: `Invalid model selected for title generation: ${modelIdToUse}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Ensure the selected model is suitable for title generation
    if (!modelConfig.usage.includes('title')) {
        console.error(`[Title API] Error: Model ${modelConfig.name} is not designated for title generation.`);
        return new Response(JSON.stringify({ error: `Model ${modelConfig.name} cannot be used for title generation.` }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    console.log(`[Title API] Using model for title generation: ${modelConfig.name} (Provider: ${modelConfig.provider}, SDK ID: ${modelConfig.sdkId})`);

    if (modelConfig.provider === 'google') {
      // Ensure GOOGLE_API_KEY is handled if necessary, or rely on ADC for Vercel AI SDK
      modelInstance = google(modelConfig.sdkId);
    } else if (modelConfig.provider === 'openrouter') {
      if (!process.env.OPENROUTER_API_KEY) {
        console.error("[Title API] Error: OPENROUTER_API_KEY is not set.");
        throw new Error("OPENROUTER_API_KEY is not set in environment variables.");
      }
      const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
      modelInstance = openrouter.chat(modelConfig.sdkId); // Assuming title generation can use .chat(), or .completion() if needed
    } else {
      console.error(`[Title API] Error: Unsupported provider: ${modelConfig.provider}`);
      return new Response(JSON.stringify({ error: `Unsupported model provider: ${modelConfig.provider}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { text: generatedTitle, usage, finishReason, providerResponse } = await generateText({
      model: modelInstance,
      prompt: prompt,
      maxTokens: 15,
      temperature: 0.3,
    });
    
    if (!generatedTitle) {
        console.error("[Title API] Title generation failed, API returned empty text.", {model: modelConfig.name, usage, finishReason, providerResponse});
        return new Response(JSON.stringify({ error: 'Failed to generate title, AI returned empty.' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    // Clean up the title using a regex to capture content between leading/trailing unwanted characters.
    const cleanupRegex = /^[\s\"\'\`]*(.*?)[\s\"\'\`]*$/;
    const match = generatedTitle.match(cleanupRegex);
    let cleanedTitle = match ? match[1] : generatedTitle;
    cleanedTitle = cleanedTitle.trim(); // Final trim, just in case, though regex should handle most.

    return new Response(JSON.stringify({ title: cleanedTitle }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error("[Title API] Error in /api/generate-title:", error);
    const errorMessage = error instanceof Error && error.message ? error.message : 'An unexpected error occurred during title generation.';
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: error.status || 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 