import { NextResponse } from 'next/server';
import { getMem0Client } from '../_utils';

export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const query = searchParams.get('query');

    if (!userId || !query) {
      return NextResponse.json({ error: 'userId and query are required' }, { status: 400 });
    }

    const mem0 = getMem0Client();
    const searchResults = await mem0.search(query, { user_id: userId });

    return NextResponse.json(searchResults, { status: 200 });

  } catch (error) {
    console.error('Mem0 Search API Error:', error);
    let errorMessage = 'Failed to search memories';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
} 