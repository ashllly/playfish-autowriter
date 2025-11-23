import { NextResponse } from 'next/server';
import { runSourceRunner } from '@/services/source-runner';

export async function GET(request: Request) {
  // Vercel Cron routes are protected by Vercel's infrastructure
  // No additional authentication needed - only Vercel can call these routes
  // For manual testing, you can call /api/runner/source instead

  try {
    const result = await runSourceRunner();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Source Runner executed successfully',
      data: result 
    });
  } catch (error) {
    console.error('Source Runner Failed:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

