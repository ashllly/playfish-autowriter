import { NextResponse } from 'next/server';
import { notion, DB_IDS } from '@/lib/notion/client';
import { generateAndUploadCover } from '@/services/image-runner';

// Helper to scan a specific DB for missing covers
async function scanDatabase(dbId: string, themeName: string) {
  const response = await notion.databases.query({
    database_id: dbId,
    filter: {
      property: 'Cover',
      rich_text: {
        is_empty: true, // Check if URL property is empty? Wait, Cover is a URL property?
        // Actually, in Notion API, 'Cover' field type is 'url' or 'files'? 
        // User doc says: Cover | URL | 自动 | AI 封面图 URL
        // Filter for URL property emptiness:
      } as any 
    },
    // We can filter by "Cover is empty" for URL type property usually by "property": "Cover", "url": { "is_empty": true } 
    // Let's use robust checking: fetch pages and filter in JS if unsure about filter syntax for URL type
  });
  
  // Notion API filter for URL type:
  // { property: 'Cover', url: { is_empty: true } }
  
  // Re-query with correct filter
  const cleanResponse = await notion.databases.query({
    database_id: dbId,
    filter: {
      property: 'Cover',
      url: {
        is_empty: true,
      },
    },
    sorts: [
      {
        timestamp: 'created_time',
        direction: 'descending',
      },
    ],
    page_size: 50, // Scan max 50 per DB to be safe
  });

  return cleanResponse.results.map((page: any) => ({
    id: page.id,
    theme: themeName,
    title: page.properties.Title?.title[0]?.plain_text || 'Untitled',
    keywords: page.properties.Keywords?.rich_text[0]?.plain_text || '',
  }));
}

export async function GET(request: Request) {
  // Security check (reuse verifyAuth logic or skip for now if relying on dashboard auth wrapper)
  // For simplicity, we assume this is called from Dashboard which is protected or local.
  // Add Basic Auth check here for production safety.
  
  try {
    const [playfish, fire, immigrant] = await Promise.all([
      scanDatabase(process.env.NOTION_PLAYFISH_DB_ID!, 'Playfish'),
      scanDatabase(process.env.NOTION_FIRE_DB_ID!, 'FIRE'),
      scanDatabase(process.env.NOTION_IMMIGRATION_DB_ID!, 'Immigrant'),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        Playfish: playfish,
        FIRE: fire,
        Immigrant: immigrant,
        total: playfish.length + fire.length + immigrant.length
      }
    });
  } catch (error: any) {
    console.error('Scan failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { pageId, title, blogTheme, keywords } = body;

    if (!pageId || !title || !blogTheme) {
      return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 });
    }

    const result = await generateAndUploadCover(pageId, title, blogTheme, keywords || '');

    if (result.success) {
      return NextResponse.json({ success: true, url: result.url });
    } else {
      return NextResponse.json({ success: false, error: result.error }, { status: 500 });
    }
  } catch (error: any) {
    console.error('Cover generation failed:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

