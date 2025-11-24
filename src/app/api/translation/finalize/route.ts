import { NextResponse } from 'next/server';
import { finalizeTranslation } from '@/services/translation-runner';

export const maxDuration = 60; 
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
        pageId, 
        targetLang, 
        blogTheme, 
        translatedTitle, 
        originalTagSlugs 
    } = body;

    if (!pageId || !targetLang || !blogTheme) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const result = await finalizeTranslation(
        pageId,
        targetLang,
        blogTheme,
        translatedTitle,
        originalTagSlugs || []
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Translation Finalize Failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

