import { NextResponse } from 'next/server';
import { getMem0Client } from '../_utils';

export async function DELETE(req) {
  try {
    const body = await req.json();
    const { userId, memoryId } = body;

    if (!userId || !memoryId) {
      return NextResponse.json({ error: 'userId and memoryId are required' }, { status: 400 });
    }

    const mem0 = getMem0Client();

    // 1. Delete the memory from Mem0.ai
    // Pass memory_id and user_id in an options object.
    await mem0.delete({ memory_id: memoryId, user_id: userId }); 

    // 2. Trigger Full Refresh: Fetch all remaining memories for the user from Mem0.ai
    const allMemories = await mem0.getAll({ user_id: userId });

    // 3. Return success response with all remaining memories
    return NextResponse.json(allMemories, { status: 200 });

  } catch (error) {
    console.error('Mem0 Delete API Error:', error);
    let errorMessage = 'Failed to delete memory';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 