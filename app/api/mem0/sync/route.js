import { NextResponse } from 'next/server';
import { getMem0Client } from '../_utils';

export async function POST(req) {
  try {
    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const mem0 = getMem0Client();

    // Fetch all memories for the user from Mem0.ai
    const allMemories = await mem0.getAll({ user_id: userId });

    // Return success response with all memories for the client to update its local store
    return NextResponse.json(allMemories, { status: 200 });

  } catch (error) {
    console.error('Mem0 Sync API Error:', error);
    let errorMessage = 'Failed to sync memories';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 