import { google } from '@ai-sdk/google';
import { streamText, smoothStream } from 'ai';

export const dynamic = 'force-dynamic';

// const googleProvider = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || ''); // Old incorrect way

export async function POST(req) {
  const { messages } = await req.json();

  try {
    const result = streamText({
      model: google('gemini-2.0-flash', { useSearchGrounding: true }), 
      messages,
      experimental_transform: smoothStream({
        delayInMs: 10, // Default delay, can be adjusted
        chunking: 'word' // Default chunking, streams word by word
      }),
      // Optional: Add error handling for the stream itself if needed
      // onError: (error) => { console.error("Streaming Error:", error); }
    });

    // Switch to toDataStreamResponse for better compatibility with useChat
    return result.toDataStreamResponse();

  } catch (error) {
    // Catch synchronous errors during setup, e.g., API key issues
    console.error("API Route Error:", error);
    return new Response(JSON.stringify({ error: error.message || 'An unexpected error occurred.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
} 