import { notion, DB_IDS, getPageContent, PageContent } from '@/lib/notion/client';
import { openai, MODELS } from '@/lib/openai/client';
import { PROMPTS } from '@/lib/openai/prompts';
import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';

// Types
export type TranslationTask = {
  sourcePageId: string;
  title: string;
  sourceId: string;
  missingLangs: ('en' | 'zh-hant')[];
  blogTheme: string;
  publishedDate: string;
};

type GroupedPage = {
  zh_hans?: any;
  en?: any;
  zh_hant?: any;
};

// Helper to map DB ID to Theme Name
function getThemeByDbId(dbId: string): string {
  if (dbId === process.env.NOTION_PLAYFISH_DB_ID) return 'Playfish';
  if (dbId === process.env.NOTION_FIRE_DB_ID) return 'FIRE';
  if (dbId === process.env.NOTION_IMMIGRATION_DB_ID) return 'Immigrant';
  return 'Unknown';
}

function getDbIdByTheme(theme: string): string {
  if (theme === 'Playfish') return process.env.NOTION_PLAYFISH_DB_ID!;
  if (theme === 'FIRE') return process.env.NOTION_FIRE_DB_ID!;
  if (theme === 'Immigrant') return process.env.NOTION_IMMIGRATION_DB_ID!;
  throw new Error(`Unknown theme: ${theme}`);
}

// 1. Scan Logic
export async function scanForMissingTranslations(): Promise<TranslationTask[]> {
  const dbIds = [
    process.env.NOTION_PLAYFISH_DB_ID!,
    process.env.NOTION_FIRE_DB_ID!,
    process.env.NOTION_IMMIGRATION_DB_ID!
  ];

  let allTasks: TranslationTask[] = [];

  for (const dbId of dbIds) {
    if (!dbId) continue;
    const theme = getThemeByDbId(dbId);

    // Fetch all published articles (limit 100 for performance)
    const response = await notion.databases.query({
      database_id: dbId,
      filter: {
        property: 'Published',
        checkbox: {
          equals: true,
        },
      },
      sorts: [
        {
          timestamp: 'created_time',
          direction: 'descending',
        },
      ],
      page_size: 100,
    });

    // Group by SourceID
    const groups: Record<string, GroupedPage> = {};

    for (const page of response.results as any[]) {
      // Get SourceID (primary key)
      const sourceId = page.properties.SourceID?.rich_text[0]?.plain_text;
      if (!sourceId) continue;

      // Get Lang
      const lang = page.properties.Lang?.select?.name; // zh-hans, en, zh-hant
      if (!lang) continue;

      if (!groups[sourceId]) {
        groups[sourceId] = {};
      }

      if (lang === 'zh-hans') groups[sourceId].zh_hans = page;
      else if (lang === 'en') groups[sourceId].en = page;
      else if (lang === 'zh-hant') groups[sourceId].zh_hant = page;
    }

    // Identify missing translations
    for (const [sourceId, group] of Object.entries(groups)) {
      // Only process if we have the source (zh-hans) article
      if (!group.zh_hans) continue;

      const missing: ('en' | 'zh-hant')[] = [];
      if (!group.en) missing.push('en');
      if (!group.zh_hant) missing.push('zh-hant');

      if (missing.length > 0) {
        allTasks.push({
          sourcePageId: group.zh_hans.id,
          title: group.zh_hans.properties.Title?.title[0]?.plain_text || 'Untitled',
          sourceId: sourceId,
          missingLangs: missing,
          blogTheme: theme,
          publishedDate: group.zh_hans.created_time,
        });
      }
    }
  }

  return allTasks;
}

// 2. Translate Logic
export async function translateArticle(
  sourcePageId: string,
  targetLang: 'en' | 'zh-hant',
  blogTheme: string
) {
  console.log(`🌍 Translating ${sourcePageId} to ${targetLang} (${blogTheme})...`);

  try {
    // 1. Fetch Source Page Content & Properties
    const sourcePage = await notion.pages.retrieve({ page_id: sourcePageId }) as any;
    const sourceContent = await getPageContent(sourcePageId);
    const props = sourcePage.properties;

    // Inherit Fields
    const title = props.Title?.title[0]?.plain_text || '';
    const slug = props.Slug?.rich_text[0]?.plain_text || '';
    const coverUrl = props.Cover?.url || null; // Inherit Cover URL (not Page Cover)
    const tagSlug = props['tag-slug']?.multi_select || []; // Inherit Tag Slugs
    const section = props.Section?.select?.name || 'playfish';
    const sourceId = props.SourceID?.rich_text[0]?.plain_text || '';
    const draftId = props.DraftID?.rich_text[0]?.plain_text || '';
    
    // 2. Call OpenAI for Translation
    const prompt = targetLang === 'en' ? PROMPTS.PF_TRANSLATE_EN : PROMPTS.PF_TRANSLATE_ZHT;
    const userContent = `Title: ${title}\n\nContent:\n${sourceContent.text}`;

    const completion = await openai.chat.completions.create({
      model: MODELS.TRANSLATE, // gpt-4o-mini is fine
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    });

    const resultJson = completion.choices[0]?.message?.content;
    if (!resultJson) throw new Error('Empty translation response');
    const translated = JSON.parse(resultJson);

    // 3. Create New Page in Notion
    const targetDbId = getDbIdByTheme(blogTheme);
    
    // Prepare Content Blocks
    const contentBlocks: any[] = [];
    const MAX_CHUNK_LENGTH = 1800;
    const translatedText = translated.content || '';
    
    for (let i = 0; i < translatedText.length; i += MAX_CHUNK_LENGTH) {
      contentBlocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: {
          rich_text: [{ text: { content: translatedText.substring(i, i + MAX_CHUNK_LENGTH) } }],
        },
      });
    }

    const newPage = await notion.pages.create({
      parent: { database_id: targetDbId },
      properties: {
        Title: {
          title: [{ text: { content: translated.title || title } }],
        },
        Lang: {
          select: { name: targetLang },
        },
        SourceID: {
          rich_text: [{ text: { content: sourceId } }],
        },
        DraftID: {
          rich_text: [{ text: { content: draftId } }],
        },
        Slug: {
          rich_text: [{ text: { content: slug } }], // Inherit
        },
        'meta-title': {
          rich_text: [{ text: { content: translated.meta_title || '' } }],
        },
        Description: {
          rich_text: [{ text: { content: translated.description || '' } }],
        },
        Keywords: {
          rich_text: [{ text: { content: translated.keywords || '' } }],
        },
        Tag: {
          multi_select: (translated.tags || []).map((t: string) => ({ name: t })), // Translated Tags
        },
        'tag-slug': {
          multi_select: tagSlug, // Inherit
        },
        Section: {
          select: { name: section }, // Inherit
        },
        Cover: coverUrl ? {
          url: coverUrl // Inherit
        } : undefined,
        Published: {
          checkbox: false, // Default to Unpublished for review
        },
      },
      children: contentBlocks as BlockObjectRequest[],
    });

    return { success: true, url: newPage.url, lang: targetLang };

  } catch (error: any) {
    console.error('Translation Failed:', error);
    return { success: false, error: error.message };
  }
}

// 3. Auto Translation Logic (Smart Filler)
export async function runAutoTranslation() {
  console.log('🤖 Starting Auto Translation (Smart Filler)...');
  
  try {
    // 1. Scan for missing tasks
    const tasks = await scanForMissingTranslations();
    
    if (tasks.length === 0) {
      console.log('No missing translations found.');
      return { processed: 0, message: 'No tasks found' };
    }

    // 2. Pick ONE task (the latest one)
    // tasks are already sorted by publishedDate DESC in scan logic (actually sort is applied to Notion query, but scan iterates DBs)
    // Let's sort allTasks by date just to be sure
    tasks.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
    
    const task = tasks[0];
    const targetLang = task.missingLangs[0]; // Pick the first missing lang (e.g. 'en' before 'zh-hant')

    console.log(`Selected Task: ${task.title} -> ${targetLang}`);

    // 3. Execute Translation
    const result = await translateArticle(task.sourcePageId, targetLang, task.blogTheme);

    if (result.success) {
      console.log('Auto Translation Success');
      return { processed: 1, result };
    } else {
      console.error('Auto Translation Failed:', result.error);
      return { processed: 0, error: result.error };
    }

  } catch (error: any) {
    console.error('Auto Translation Error:', error);
    return { processed: 0, error: error.message };
  }
}

