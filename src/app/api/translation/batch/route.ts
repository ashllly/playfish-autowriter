import { NextResponse } from 'next/server';
import { translateAndWriteBatch } from '@/services/translation-runner';

export const maxDuration = 60; // Allow 60s for batch processing
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
        batchIndex, 
        targetLang, 
        blogTheme, 
        blocksBatch, 
        pageProperties, 
        existingPageId 
    } = body;

    if (batchIndex === undefined || !targetLang || !blogTheme || !blocksBatch) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const result = await translateAndWriteBatch(
        batchIndex,
        targetLang,
        blogTheme,
        blocksBatch,
        pageProperties,
        existingPageId
    );

    return NextResponse.json({ success: true, data: result });
  } catch (error: any) {
    console.error('Translation Batch Failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

