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
    // Assuming mem0.delete() takes the memory ID directly.
    // If it requires an object like { memory_id: memoryId }, this would need adjustment.
    // Based on some Mem0 docs, `client.delete("memory-id-here")` is a pattern.
    await mem0.delete(memoryId); 

    // 2. Trigger Full Refresh: Fetch all remaining memories for the user from Mem0.ai
    const allMemories = await mem0.getAll({ userId });

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