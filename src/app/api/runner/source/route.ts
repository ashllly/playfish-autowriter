import { NextResponse } from 'next/server';
import { runSourceRunner } from '@/services/source-runner';

/**
 * Manual trigger endpoint for Source Runner
 * Security: Basic Auth (username/password from env)
 */
function verifyAuth(request: Request): boolean {
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
  // Verify Basic Auth
  if (!verifyAuth(request)) {
    return new Response('Unauthorized', { 
      status: 401,
      headers: {
        'WWW-Authenticate': 'Basic realm="Playfish AutoWriter"',
      },
    });
  }

  try {
    console.log('Manual Source Runner triggered');
    const result = await runSourceRunner();
    
    return NextResponse.json({ 
      success: true, 
      message: 'Source Runner executed successfully',
      data: result 
    });
  } catch (error: any) {
    console.error('Source Runner Failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Internal Server Error',
      stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined
    }, { status: 500 });
  }
}

// Also support GET for easy browser testing (with Basic Auth)
export async function GET(request: Request) {
  return POST(request);
}

