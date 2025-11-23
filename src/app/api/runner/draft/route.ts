import { NextResponse } from 'next/server';
import { runDraftRunner } from '@/services/draft-runner';

/**
 * Manual trigger endpoint for Draft Runner
 * Security: Basic Auth (username/password from env)
 */
function verifyAuth(request: Request): boolean {
  // In development, allow skipping auth if SKIP_AUTH is set or env vars are not configured
  if (process.env.NODE_ENV === 'development') {
    if (process.env.SKIP_AUTH === 'true') {
      console.warn('⚠️  SKIP_AUTH=true. Allowing access in development mode.');
      return true;
    }
    const username = process.env.BASIC_AUTH_USERNAME?.trim();
    const password = process.env.BASIC_AUTH_PASSWORD?.trim();
    if (!username || !password) {
      console.warn('⚠️  Basic Auth not configured. Allowing access in development mode.');
      return true;
    }
  }

  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Basic ')) {
    return false;
  }

  const base64Credentials = authHeader.split(' ')[1];
  const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
  const [username, password] = credentials.split(':');

  return (
    username === process.env.BASIC_AUTH_USERNAME &&
    password === process.env.BASIC_AUTH_PASSWORD
  );
}

export async function POST(request: Request) {
  if (!verifyAuth(request)) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Playfish AutoWriter"',
      },
    });
  }

  try {
    console.log('Manual Draft Runner triggered');
    const result = await runDraftRunner();
    
    if (result.errors && result.processed === 0) {
      return NextResponse.json({ 
        success: false, 
        message: 'Draft Runner encountered errors',
        data: result 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Draft Runner executed successfully',
      data: result 
    });
  } catch (error: any) {
    console.error('Draft Runner Failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Internal Server Error' 
    }, { status: 500 });
  }
}

export async function GET(request: Request) {
  return POST(request);
}

