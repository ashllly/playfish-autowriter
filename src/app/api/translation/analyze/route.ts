import { NextResponse } from 'next/server';
import { getArticleSourceData } from '@/services/translation-runner';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourcePageId } = body;

    if (!sourcePageId) {
      return NextResponse.json({ success: false, error: 'Missing sourcePageId' }, { status: 400 });
    }

    const result = await getArticleSourceData(sourcePageId);

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Translation Analysis Failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

