import { NextResponse } from 'next/server';
import { runSeoFixerRunner } from '@/services/seo-fixer-runner';

export const maxDuration = 300; // 5 minutes (Manual triggers allow longer time)

function verifyAuth(request: Request): boolean {
  // In development, allow skipping auth if SKIP_AUTH is set or CRON_SECRET is not configured
  if (process.env.NODE_ENV === 'development') {
    if (process.env.SKIP_AUTH === 'true') {
      console.warn('⚠️  SKIP_AUTH=true. Allowing access in development mode.');
      return true;
    }
    if (!process.env.CRON_SECRET) {
      console.warn('⚠️  CRON_SECRET not configured. Allowing access in development mode.');
      return true;
    }
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  return token === process.env.CRON_SECRET;
}

export async function GET(request: Request) {
  if (!verifyAuth(request)) {
    return new NextResponse('Unauthorized', { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Bearer realm="Playfish AutoWriter"',
      },
    });
  }

  // Parse query params for optional targeting
  const { searchParams } = new URL(request.url);
  const targetDb = searchParams.get('target') as 'Playfish' | 'FIRE' | 'Immigrant' | undefined;

  try {
    const result = await runSeoFixerRunner({ targetDb });
    return NextResponse.json({
      success: true,
      message: 'SEO Fixer executed successfully',
      data: result
    });
  } catch (error: any) {
    console.error('Manual SEO Fix Error:', error);
    return NextResponse.json({ 
      success: false,
      error: error.message 
    }, { status: 500 });
  }
}

// Also support POST for consistency
export async function POST(request: Request) {
  return GET(request);
}

