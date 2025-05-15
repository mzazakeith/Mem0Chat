import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from 'ai';

export const dynamic = 'force-dynamic';

// Initialize OpenRouter provider
const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
  // You can add other OpenRouter specific configurations here if needed
  // For example, referringSite or appName if OpenRouter supports/requires them
  // headers: {
  //   "HTTP-Referer": YOUR_SITE_URL, // Replace YOUR_SITE_URL with your actual site URL
  //   "X-Title": YOUR_APP_NAME, // Replace YOUR_APP_NAME with your actual app name
  // },
});

export async function POST(req) {
  try {
    const { messageContent } = await req.json();

    if (!messageContent) {
      return new Response(JSON.stringify({ error: 'messageContent is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Simple prompt for title generation
    const prompt = `Generate a very short, concise title (max 3 words) for a chat conversation that starts with this message: "${messageContent}". The title should be suitable for a chat list. Do not add quotes around the title. Return only the title, no other text or comments or punctuation.`;

    const { text: generatedTitle, usage, finishReason, providerResponse } = await generateText({
      // model: openrouter.chat('openrouter/auto'), // Automatically select best model (if supported and desired)
      // model: openrouter.chat('anthropic/claude-3-haiku-20240307'), // A fast and capable model
      // model: openrouter.chat('meta-llama/llama-3.1-8b-instruct'), // Using a Llama 3.1 8B model
      model: openrouter.chat('deepseek/deepseek-prover-v2:free'), // Using DeepSeek Prover V2 (free)
      prompt: prompt,
      maxTokens: 15, // Max tokens for the title
      temperature: 0.3, // Lower temperature for more deterministic titles
    });
    
    if (!generatedTitle) {
        console.error("Title generation failed, API returned empty text.", {usage, finishReason, providerResponse});
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
    console.error("Error in /api/generate-title:", error);
    let errorMessage = 'An unexpected error occurred during title generation.';
    if (error.message) {
        errorMessage = error.message;
    }
    // Check for specific OpenRouter error structures if available
    // For example, if (error.status === 401) errorMessage = "Invalid OpenRouter API Key."
    
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: error.status || 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 