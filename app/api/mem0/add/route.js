import { NextResponse } from 'next/server';
import { getMem0Client } from '../_utils'; // Adjusted path based on location

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId, content } = body;

    if (!userId || !content) {
      return NextResponse.json({ error: 'userId and content are required' }, { status: 400 });
    }

    const mem0 = getMem0Client();

    // 1. Add the new memory to Mem0.ai
    // The add method might return information about the added memory.
    // Ensure user_id is passed in the options object.
    // The content being added is a simple string from the request.
    const addResponse = await mem0.add(content, { user_id: userId });

    // 2. Trigger Full Refresh: Fetch all memories for the user from Mem0.ai
    const allMemories = await mem0.getAll({ user_id: userId });

    // 3. Return success response with all memories for the client to update its local store
    return NextResponse.json(allMemories, { status: 200 });

  } catch (error) {
    console.error('Mem0 Add API Error:', error);
    let errorMessage = 'Failed to add memory';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 