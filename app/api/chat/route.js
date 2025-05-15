import { google } from '@ai-sdk/google';
import { streamText, smoothStream } from 'ai';
import { getMem0Client } from '../mem0/_utils'; // Adjusted path

export const dynamic = 'force-dynamic';

// const googleProvider = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''); // Old incorrect way

export async function POST(req) {
  const rawBody = await req.json();
  console.log("RAW BODY RECEIVED IN /api/chat:", JSON.stringify(rawBody, null, 2));

  // Destructure messages and experimental_customTool from the request body
  const { messages, experimental_customTool } = rawBody;

  let finalMessages = [...messages]; // Start with a copy of original messages
  let systemPromptContent = "You are a helpful AI."; // Default system prompt

  // Find existing system message to potentially prepend to it
  const existingSystemMessageIndex = finalMessages.findIndex(m => m.role === 'system');
  if (existingSystemMessageIndex !== -1) {
    systemPromptContent = finalMessages[existingSystemMessageIndex].content;
  } else {
    // If no system prompt exists, we will create one later. For now, systemPromptContent holds the default.
  }

  // Check if memory activation is requested from the client
  const activateMemories = experimental_customTool?.activateMemories;
  const userId = experimental_customTool?.userId;
  console.log(`[Chat API] Memory Activation: ${activateMemories}, User ID: ${userId}`); // Log 1

  let memoriesSection = ""; // This will hold the formatted memories or a status message

  if (activateMemories && userId) {
    try {
      const mem0 = getMem0Client();
      const lastUserMessage = finalMessages.filter(m => m.role === 'user').pop()?.content;
      console.log("[Chat API] Last User Message for memory search:", lastUserMessage); // Log 2

      if (lastUserMessage) {
        // Retrieve relevant memories (e.g., top 3)
        const relevantMemories = await mem0.search(lastUserMessage, { 
          user_id: userId, 
          limit: 3 // Limiting to top 3 relevant memories
        });
        console.log("[Chat API] Relevant Memories from Mem0:", JSON.stringify(relevantMemories, null, 2)); // Log 3

        if (relevantMemories && Array.isArray(relevantMemories) && relevantMemories.length > 0) {
          const memoriesStr = relevantMemories
            // .slice(0, 3) // No longer needed if limit is effective in search()
            .map(entry => `- ${entry.memory || entry.content}`) 
            .join('\n');
          console.log("[Chat API] Constructed memoriesStr:", memoriesStr); // Log 4
          
          memoriesSection = `
--- Relevant User Memories ---
${memoriesStr}
--- End of Memories ---`;
        } else {
          memoriesSection = `
--- User Memories ---
No specific relevant user memories found for this query.
--- End of Memories ---`;
        }
      } else {
        memoriesSection = `
--- User Memories ---
Could not determine the last user message to search memories.
--- End of Memories ---`;
      }
      console.log("[Chat API] Constructed memoriesSection:", memoriesSection); // Log 5
    } catch (memError) {
      console.error("[Chat API] Error retrieving or processing memories:", memError);
      memoriesSection = `
--- User Memories ---
There was an issue retrieving memories. Proceeding without them.
--- End of Memories ---`;
      console.log("[Chat API] memoriesSection after error:", memoriesSection); // Log 6
    }
  }

  // Construct the final system prompt content
  // If memories were processed, they are in memoriesSection. 
  // We always add a clear separator for the current conversation part.
  let finalSystemPromptContent = systemPromptContent;
  if (memoriesSection) {
    finalSystemPromptContent = `${systemPromptContent}${memoriesSection}`;
  }
  finalSystemPromptContent = `${finalSystemPromptContent}\n\n--- Current Conversation ---`;
  console.log("[Chat API] Final System Prompt Content:", finalSystemPromptContent); // Log 7

  // Update or add the system message
  if (existingSystemMessageIndex !== -1) {
    finalMessages[existingSystemMessageIndex] = { role: 'system', content: finalSystemPromptContent };
  } else {
    finalMessages.unshift({ role: 'system', content: finalSystemPromptContent });
  }

  try {
    const result = streamText({
      model: google('models/gemini-1.5-flash-latest'), 
      messages: finalMessages, // Use the potentially modified messages array
      experimental_transform: smoothStream({
        delayInMs: 10, 
        chunking: 'word' 
      }),
    });
    return result.toDataStreamResponse();
  } catch (error) {
    console.error("[Chat API] Error (Post-Memory Processing):", error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 