import { NextResponse } from 'next/server';
import { runSourceRunner } from '@/services/source-runner';
import { runDraftRunner } from '@/services/draft-runner';

// Vercel Hobby Plan allows only 1 Cron Job.
// This "Master Runner" executes tasks sequentially to fit within that limit.
export async function GET(request: Request) {
  console.log('⏰ Daily Master Runner started...');
  const results: any = {};

  try {
    // 1. Run Source Runner
    console.log('▶️ Step 1: Running Source Runner...');
    const sourceResult = await runSourceRunner();
    results.source = sourceResult;
    console.log('✅ Source Runner done:', sourceResult);

    // 2. Run Draft Runner
    console.log('▶️ Step 2: Running Draft Runner...');
    const draftResult = await runDraftRunner();
    results.draft = draftResult;
    console.log('✅ Draft Runner done:', draftResult);

    // Check for critical errors
    if (
      (sourceResult.error && sourceResult.processed === 0) || 
      (draftResult.errors && draftResult.processed === 0)
    ) {
      return NextResponse.json({ 
        success: false, 
        message: 'Daily Runner encountered errors',
        data: results 
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Daily Runner executed successfully',
      data: results 
    });

  } catch (error: any) {
    console.error('❌ Daily Runner Failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Internal Server Error',
      data: results
    }, { status: 500 });
  }
}

