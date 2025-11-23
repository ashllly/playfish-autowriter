import { NextResponse } from 'next/server';
import { scanForMissingTranslations, translateArticle } from '@/services/translation-runner';

export async function GET(request: Request) {
  try {
    const tasks = await scanForMissingTranslations();
    return NextResponse.json({
      success: true,
      data: tasks,
      count: tasks.length
    });
  } catch (error: any) {
    console.error('Translation Scan Failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sourcePageId, targetLang, blogTheme } = body;

    if (!sourcePageId || !targetLang || !blogTheme) {
      return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 });
    }

    const result = await translateArticle(sourcePageId, targetLang, blogTheme);

    if (result.success) {
      return NextResponse.json({ success: true, data: result });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Translation Execution Failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

