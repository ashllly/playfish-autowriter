import { notion, DB_IDS, getPageContent, PageContent, appendBlocksToPage } from '@/lib/notion/client';
import { openai, MODELS } from '@/lib/openai/client';
import { PROMPTS } from '@/lib/openai/prompts';
import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
import { getTagName } from '@/lib/constants/tags';
import { markdownToBlocks } from '@/lib/notion/markdown';

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
    const tagSlug = (props['tag-slug']?.multi_select || []).map((t: any) => ({ name: t.name })); // Inherit Tag Slugs
    const section = props.Section?.select?.name || 'playfish';
    const sourceId = props.SourceID?.rich_text[0]?.plain_text || '';
    const draftId = props.DraftID?.rich_text[0]?.plain_text || '';
    const publicationDate = props.PublicationDate?.date?.start || null; // Inherit PublicationDate
    
    // --- NEW TAG LOGIC (Slug-Centric) ---
    // 1. Get Source Tag Slugs (The SSOT)
    const sourceTagSlugs: string[] = (props['tag-slug']?.multi_select || []).map((t: any) => t.name);
    // We do NOT look at sourceTagNames (props.Tag) anymore.

    // 2. Separate Known (Dict) vs Pending (New Slugs)
    const knownTagsMap: Record<string, string> = {}; // slug -> translated name
    const pendingSlugsToTranslate: string[] = [];

    sourceTagSlugs.forEach((slug) => {
       const dictName = getTagName(blogTheme, slug, targetLang);
       if (dictName) {
         knownTagsMap[slug] = dictName;
       } else {
         pendingSlugsToTranslate.push(slug);
       }
    });

    // 3. Call OpenAI for Translation
    let prompt = targetLang === 'en' ? PROMPTS.PF_TRANSLATE_EN : PROMPTS.PF_TRANSLATE_ZHT;

    // Inject instruction for Pending Slugs
    if (pendingSlugsToTranslate.length > 0) {
      prompt += `\n\n[MANDATORY TAG GENERATION]\nWe have some new tags defined by slugs. Please generate a natural ${targetLang === 'en' ? 'English' : 'Traditional Chinese'} tag name for each slug.\nInput Slugs: ${JSON.stringify(pendingSlugsToTranslate)}\n\nIMPORTANT: Return a "translated_tags" field in your JSON response mapping the SLUG to the GENERATED TAG NAME. Example: { "translated_tags": { "ai-tools": "AI Tools" } }`;
    }

    const userContent = `Title: ${title}\n\nContent:\n${sourceContent.text}`;

    const completion = await openai.chat.completions.create({
      model: MODELS.TRANSLATE,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_object' },
    });

    const resultJson = completion.choices[0]?.message?.content;
    if (!resultJson) throw new Error('Empty translation response');
    const translated = JSON.parse(resultJson);

    // 4. Construct Final Tags (Strictly following Slug order)
    const gptGeneratedTagsMap = translated.translated_tags || {};
    
    const finalTags: string[] = sourceTagSlugs.map(slug => {
      // Priority 1: Dictionary
      if (knownTagsMap[slug]) return knownTagsMap[slug];
      
      // Priority 2: GPT Generated
      if (gptGeneratedTagsMap[slug]) return gptGeneratedTagsMap[slug];
      
      // Fallback: Use Slug itself as Tag Name (better than nothing or mismatch)
      return slug;
    });

    // --- END NEW TAG LOGIC ---

    // 5. Create New Page in Notion
    const targetDbId = getDbIdByTheme(blogTheme);
    
    // Parse Markdown to Blocks
    const contentBlocks = markdownToBlocks(translated.content || '');
    const initialBlocks = contentBlocks.slice(0, 100);
    const remainingBlocks = contentBlocks.slice(100);
    
    const newPageProperties: any = {
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
        multi_select: finalTags.map((t: string) => ({ name: t })), // Use Final Merged Tags
      },
      'tag-slug': {
        multi_select: tagSlug, // Inherit
      },
      Section: {
        select: { name: section }, // Inherit
      },
      Published: {
        checkbox: true, // Auto Publish
      },
    };

    if (coverUrl) {
      newPageProperties.Cover = {
        url: coverUrl,
      };
    }

    if (publicationDate) {
      newPageProperties.PublicationDate = {
        date: { start: publicationDate },
      };
    }

    const newPage = await notion.pages.create({
      parent: { database_id: targetDbId },
      properties: newPageProperties,
      children: initialBlocks,
    });

    if (remainingBlocks.length > 0) {
       await appendBlocksToPage(newPage.id, remainingBlocks);
    }

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
