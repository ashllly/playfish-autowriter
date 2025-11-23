import { NextResponse } from 'next/server';
import { runSourceRunner } from '@/services/source-runner';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET_TOKEN}`) {
    return new Response('Unauthorized', { status: 401 });
  }

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

