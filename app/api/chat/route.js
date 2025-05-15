import { google } from '@ai-sdk/google';
import { streamText, smoothStream } from 'ai';
import { getMem0Client } from '../mem0/_utils'; 
import { ALL_AVAILABLE_MODELS, getDefaultModelForUsage, getModelConfigById } from '../../../lib/models'; // Adjusted path
import { createOpenRouter } from '@openrouter/ai-sdk-provider'; // Added OpenRouter import

export const dynamic = 'force-dynamic';

export async function POST(req) {
  const rawBody = await req.json();
  console.log("RAW BODY RECEIVED IN /api/chat:", JSON.stringify(rawBody, null, 2));

  const { messages, experimental_customTool, modelId: requestedModelId } = rawBody; // Expect modelId here

  let finalMessages = [...messages];
  let systemPromptContent = "You are a helpful AI.";

  const existingSystemMessageIndex = finalMessages.findIndex(m => m.role === 'system');
  if (existingSystemMessageIndex !== -1) {
    systemPromptContent = finalMessages[existingSystemMessageIndex].content;
  }

  const activateMemories = experimental_customTool?.activateMemories;
  const userId = experimental_customTool?.userId;
  console.log(`[Chat API] Memory Activation: ${activateMemories}, User ID: ${userId}`);

  let memoriesSection = "";

  if (activateMemories && userId) {
    try {
      const mem0 = getMem0Client();
      const lastUserMessage = finalMessages.filter(m => m.role === 'user').pop()?.content;
      console.log("[Chat API] Last User Message for memory search:", lastUserMessage);

      if (lastUserMessage) {
        const relevantMemories = await mem0.search(lastUserMessage, { 
          user_id: userId, 
          limit: 3 
        });
        console.log("[Chat API] Relevant Memories from Mem0:", JSON.stringify(relevantMemories, null, 2));

        if (relevantMemories && Array.isArray(relevantMemories) && relevantMemories.length > 0) {
          const memoriesStr = relevantMemories
            .map(entry => `- ${entry.memory || entry.content}`)
            .join('\n');
          memoriesSection = `\n--- Relevant User Memories ---\n${memoriesStr}\n--- End of Memories ---`;
        } else {
          memoriesSection = `\n--- User Memories ---\nNo specific relevant user memories found for this query.\n--- End of Memories ---`;
        }
      } else {
        memoriesSection = `\n--- User Memories ---\nCould not determine the last user message to search memories.\n--- End of Memories ---`;
      }
    } catch (memError) {
      console.error("[Chat API] Error retrieving or processing memories:", memError);
      memoriesSection = `\n--- User Memories ---\nThere was an issue retrieving memories. Proceeding without them.\n--- End of Memories ---`;
    }
  }

  let finalSystemPromptContent = systemPromptContent;
  if (memoriesSection) {
    finalSystemPromptContent = `${systemPromptContent}${memoriesSection}`;
  }
  finalSystemPromptContent = `${finalSystemPromptContent}\n\n--- Current Conversation ---`;
  console.log("[Chat API] Final System Prompt Content for model:", finalSystemPromptContent); 

  if (existingSystemMessageIndex !== -1) {
    finalMessages[existingSystemMessageIndex] = { role: 'system', content: finalSystemPromptContent };
  } else {
    finalMessages.unshift({ role: 'system', content: finalSystemPromptContent });
  }

  // Model selection logic
  let modelInstance;
  const modelIdToUse = requestedModelId || getDefaultModelForUsage('chat');
  const modelConfig = getModelConfigById(modelIdToUse);

  if (!modelConfig) {
    console.error(`[Chat API] Error: Model configuration not found for ID: ${modelIdToUse}`);
    return new Response(JSON.stringify({ error: `Invalid model selected: ${modelIdToUse}` }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  console.log(`[Chat API] Using model: ${modelConfig.name} (Provider: ${modelConfig.provider}, SDK ID: ${modelConfig.sdkId})`);

  try {
    if (modelConfig.provider === 'google') {
      modelInstance = google(modelConfig.sdkId);
    } else if (modelConfig.provider === 'openrouter') {
      if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is not set in environment variables.");
      }
      const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY });
      modelInstance = openrouter.chat(modelConfig.sdkId);
    } else {
      console.error(`[Chat API] Error: Unsupported provider: ${modelConfig.provider}`);
      return new Response(JSON.stringify({ error: `Unsupported model provider: ${modelConfig.provider}` }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const result = streamText({
      model: modelInstance,
      messages: finalMessages,
      experimental_transform: smoothStream({
        delayInMs: 10, 
        chunking: 'word' 
      }),
    });
    return result.toDataStreamResponse();

  } catch (error) {
    console.error(`[Chat API] Error (Model: ${modelConfig.name}, Provider: ${modelConfig.provider}):`, error);
    // Ensure error.message is a string, default if not
    const errorMessage = error instanceof Error && error.message ? error.message : 'An unexpected error occurred during chat processing.';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500, // Or a more specific error code if available from the error object
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 