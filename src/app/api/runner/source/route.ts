import { NextResponse } from 'next/server';
import { runSourceRunner } from '@/services/source-runner';

/**
 * Manual trigger endpoint for Source Runner
 * Security: Basic Auth (username/password from env)
 * In development: Skip auth if env vars are not set
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
    
    // Check if result contains error info (quota error, etc.)
    if (result.error) {
      return NextResponse.json({ 
        success: false, 
        message: result.error,
        errorDetails: result.errorDetails,
        data: result 
      }, { status: 402 }); // 402 Payment Required
    }
    
    if (result.warning) {
      return NextResponse.json({ 
        success: true, 
        message: 'Source Runner completed with warnings',
        warning: result.warning,
        data: result 
      });
    }
    
    return NextResponse.json({ 
      success: true, 
      message: 'Source Runner executed successfully',
      data: result 
    });
  } catch (error: any) {
    console.error('Source Runner Failed:', error);
    
    // Check for OpenAI quota errors in catch block too
    if (error?.code === 'insufficient_quota' || error?.status === 429) {
      return NextResponse.json({ 
        success: false, 
        error: 'OpenAI API 配额不足',
        errorDetails: '请检查你的 OpenAI 账户余额和账单设置。访问 https://platform.openai.com/account/billing 查看详情。',
        code: 'insufficient_quota'
      }, { status: 402 });
    }
    
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

