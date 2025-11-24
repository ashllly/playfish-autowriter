import { NextResponse } from 'next/server';
import { TAG_DEFINITIONS } from '@/lib/constants/tags';
import { saveNewTag } from '@/services/tag-service';

export async function GET(request: Request) {
  // 1. Allow skipping auth in development
  if (process.env.SKIP_AUTH === 'true') {
    console.log('⚠️ Skipping Auth for Seed Tags (SKIP_AUTH=true)');
  } else {
    // 2. Basic Auth Check
    const authHeader = request.headers.get('authorization');
    const username = process.env.BASIC_AUTH_USERNAME?.trim();
    const password = process.env.BASIC_AUTH_PASSWORD?.trim();
    
    // Only check if Auth is configured
    if (username && password) {
        if (!authHeader || !authHeader.startsWith('Basic ')) {
            return new Response('Unauthorized', { 
                status: 401, 
                headers: { 'WWW-Authenticate': 'Basic realm="Admin"' } 
            });
        }
        const credentials = Buffer.from(authHeader.split(' ')[1], 'base64').toString('utf-8');
        // Use timing-safe compare in production, but simple string compare is fine here
        if (credentials !== `${username}:${password}`) {
            console.error('Auth failed. Expected:', `${username}:${password}`, 'Received:', credentials);
            return new Response('Unauthorized', { status: 401 });
        }
    }
  }

  if (!process.env.NOTION_TAG_SYSTEM_DB_ID) {
      return NextResponse.json({ error: 'NOTION_TAG_SYSTEM_DB_ID not configured in .env.local' }, { status: 500 });
  }

  try {
    console.log('🌱 Starting Tag Seeding...');
    const tags = Object.values(TAG_DEFINITIONS).flat();
    let count = 0;

    for (const tag of tags) {
        await saveNewTag(tag);
        count++;
    }

    return NextResponse.json({ 
        success: true, 
        message: `Processed ${count} tags from static dictionary. Check server logs for details.` 
    });

  } catch (error: any) {
    console.error('Seeding failed:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
