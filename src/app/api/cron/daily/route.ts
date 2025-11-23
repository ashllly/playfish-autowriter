import { NextResponse } from 'next/server';
import { runSourceRunner } from '@/services/source-runner';
import { runDraftRunner } from '@/services/draft-runner';
import { runAutoTranslation } from '@/services/translation-runner';

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
    // Limit to 1 article per day to prevent Vercel timeout (especially with image gen)
    const draftResult = await runDraftRunner({ limit: 1 });
    results.draft = draftResult;
    console.log('✅ Draft Runner done:', draftResult);

    // 3. Smart Filler: Auto Translation
    // Only run translation if Draft Runner was idle (processed 0 items) to save time/resources
    if (draftResult.processed === 0) {
      console.log('▶️ Step 3: Draft Runner Idle. Running Auto Translation (Smart Filler)...');
      const translationResult = await runAutoTranslation();
      results.translation = translationResult;
      console.log('✅ Auto Translation done:', translationResult);
    } else {
      console.log('⏸️ Step 3: Draft Runner active. Skipping Auto Translation to prevent timeout.');
      results.translation = { skipped: true, reason: 'Draft Runner active' };
    }

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
