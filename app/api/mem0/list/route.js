import { NextResponse } from 'next/server';
import { getMem0Client } from '../_utils';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const globalMemoriesActiveParam = searchParams.get('globalMemoriesActive');

    // Convert param to boolean, defaulting to false if not present or invalid
    const globalMemoriesActive = globalMemoriesActiveParam === 'true';

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    if (!globalMemoriesActive) {
      // If global memories are not active, return empty array as per plan refinement
      return NextResponse.json({ results: [] }, { status: 200 }); 
    }

    const mem0 = getMem0Client();
    const memories = await mem0.getAll({ user_id: userId });
    
    // Mem0's getAll typically returns an object like { results: [...] } or similar structure.
    // Ensure we are returning a structure the client expects, usually an array of memories.
    // If mem0.getAll returns the array directly, then just `return NextResponse.json(memories, { status: 200 });`
    // Assuming it returns an object with a `results` key containing the array as per Mem0 docs examples.
    if (memories && Array.isArray(memories.results)) {
        return NextResponse.json(memories, { status: 200 });
    } else if (Array.isArray(memories)) { // Fallback if it returns an array directly
        return NextResponse.json({ results: memories }, { status: 200 });
    } else {
        // Handle unexpected structure from Mem0
        console.warn("Unexpected response structure from mem0.getAll:", memories);
        return NextResponse.json({ results: [] }, { status: 200 });
    }

  } catch (error) {
    console.error('Mem0 List API Error:', error);
    let errorMessage = 'Failed to list memories';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 