import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

export async function GET() {
  const token = process.env.NOTION_API_TOKEN;
  const sourceDbId = process.env.NOTION_BLOG_SOURCE_DB_ID;

  if (!token) {
    return NextResponse.json({ success: false, error: 'Missing NOTION_API_TOKEN in env' }, { status: 500 });
  }

  const notion = new Client({ auth: token });

  try {
    // 1. Test basic connectivity (get bot info)
    const me = await notion.users.me({});
    
    // 2. Try to retrieve the Source DB if ID is provided
    let dbInfo = null;
    let dbError = null;
    if (sourceDbId) {
      try {
        dbInfo = await notion.databases.retrieve({ database_id: sourceDbId });
      } catch (e: any) {
        dbError = e.message;
      }
    }

    return NextResponse.json({
      success: true,
      bot: me,
      envConfig: {
        hasToken: !!token,
        sourceDbIdProvided: sourceDbId,
        sourceDbIdLength: sourceDbId?.length
      },
      databaseCheck: {
        success: !!dbInfo,
        info: dbInfo ? { id: dbInfo.id, title: (dbInfo as any).title?.[0]?.plain_text || 'Untitled' } : null,
        error: dbError
      }
    });

  } catch (error: any) {
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      code: error.code 
    }, { status: 500 });
  }
}

