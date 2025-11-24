import { notion, DB_IDS, getPageContent, PageContent, appendBlocksToPage } from '@/lib/notion/client';
import { openai, MODELS } from '@/lib/openai/client';
import { PROMPTS } from '@/lib/openai/prompts';
import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
import { getTagName } from '@/lib/constants/tags';
import { fetchBlockTree, collectTextNodes, translateTexts, reconstructBlocks } from '@/lib/notion/block-translator';

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

// 2. Translate Logic (BLOCK-BASED)
// Refactored: Step 1 - Analysis
export async function getArticleSourceData(sourcePageId: string) {
  console.log(`🔍 Analyzing Source Page: ${sourcePageId}`);
  
  // 1. Fetch Source Page Properties
  const sourcePage = await notion.pages.retrieve({ page_id: sourcePageId }) as any;
  const props = sourcePage.properties;

  // 2. Fetch Source Block Tree
  const sourceBlocks = await fetchBlockTree(sourcePageId);

  return {
    sourcePageId,
    props,
    sourceBlocks
  };
}

// Refactored: Step 2 - Execution (Batch)
export async function translateAndWriteBatch(
  batchIndex: number,
  targetLang: 'en' | 'zh-hant',
  blogTheme: string,
  blocksBatch: any[], // Subset of top-level blocks
  pageProperties: any, // Required for batchIndex 0
  existingPageId?: string
) {
  console.log(`🚀 Processing Batch ${batchIndex} (${blocksBatch.length} blocks)...`);

  // A. Extract Texts from this batch
  const rawTexts = collectTextNodes(blocksBatch);
  
  // Special handling for Title in Batch 0
  // If Batch 0, we might want to translate the title too. 
  // However, the title is in pageProperties. 
  // Let's assume the Title is translated separately or included in the first batch texts?
  // Current logic: rawTexts.unshift(title).
  // Better: Handle title translation in Batch 0 specifically.
  
  let translatedTitle = '';
  if (batchIndex === 0 && pageProperties?.Title) {
      const title = pageProperties.Title.title[0]?.plain_text || '';
      rawTexts.unshift(title);
  }

  // B. Translate
  // If no texts to translate (e.g. only images), skip translation
  let translatedTexts: string[] = [];
  if (rawTexts.length > 0) {
      translatedTexts = await translateTexts(rawTexts, targetLang);
  }

  // Extract Title if Batch 0
  if (batchIndex === 0 && pageProperties?.Title) {
      translatedTitle = translatedTexts.shift() || '';
      // Update pageProperties with translated title
      pageProperties.Title.title[0].text.content = translatedTitle;
  }

  // C. Reconstruct Blocks
  const newContentBlocks = reconstructBlocks(blocksBatch, translatedTexts);

  // D. Write to Notion
  if (batchIndex === 0) {
    // Create New Page
    const targetDbId = getDbIdByTheme(blogTheme);
    
    // Construct clean properties for new page creation to avoid Read-only errors
    const newPageProperties: any = {
      Title: {
        title: [{ text: { content: translatedTitle } }],
      },
      Lang: {
        select: { name: targetLang },
      },
      SourceID: {
        rich_text: pageProperties.SourceID?.rich_text || [],
      },
      DraftID: {
        rich_text: pageProperties.DraftID?.rich_text || [],
      },
      Slug: {
        rich_text: pageProperties.Slug?.rich_text || [],
      },
      Section: {
        select: pageProperties.Section?.select || { name: 'playfish' }, 
      },
      'tag-slug': {
         multi_select: pageProperties['tag-slug']?.multi_select || [],
      },
      Published: {
        checkbox: true, 
      },
    };

    if (pageProperties.Cover?.url) {
      newPageProperties.Cover = { url: pageProperties.Cover.url };
    }
    if (pageProperties.PublicationDate?.date) {
      newPageProperties.PublicationDate = { date: pageProperties.PublicationDate.date };
    }

    // Ensure parent database
    const newPage = await notion.pages.create({
      parent: { database_id: targetDbId },
      properties: newPageProperties,
      children: newContentBlocks.slice(0, 100), // Notion limit
    });
    
    // If more than 100 blocks in first batch (unlikely but possible), append rest
    if (newContentBlocks.length > 100) {
        await appendBlocksToPage(newPage.id, newContentBlocks.slice(100));
    }

    return { success: true, pageId: newPage.id, translatedTitle };
  } else {
    // Append to Existing Page
    if (!existingPageId) throw new Error('Missing existingPageId for batch > 0');
    
    await appendBlocksToPage(existingPageId, newContentBlocks);
    return { success: true, pageId: existingPageId };
  }
}

// Refactored: Step 3 - Finalize (Meta & SEO)
export async function finalizeTranslation(
  pageId: string,
  targetLang: 'en' | 'zh-hant',
  blogTheme: string,
  translatedTitle: string,
  originalTagSlugs: string[]
) {
  console.log('✨ Finalizing (SEO & Meta)...');

  // Fetch the *new* page content to generate meta
  // (Or we could pass accumulated text, but reading fresh is safer/simpler)
  const pageBlocks = await fetchBlockTree(pageId);
  const allTexts = collectTextNodes(pageBlocks);
  const contextText = allTexts.join('\n').substring(0, 3000);

  const metaPrompt = PROMPTS.PF_GENERATE_META
      .replace('{{TARGET_LANG}}', targetLang === 'en' ? 'English' : 'Traditional Chinese')
      .replace('{{TITLE}}', translatedTitle)
      .replace('{{CONTENT_PREVIEW}}', contextText.replace(/\n/g, ' ')) 
      .replace('{{ORIGINAL_TAGS}}', JSON.stringify(originalTagSlugs));

    const metaCompletion = await openai.chat.completions.create({
      model: MODELS.SEO, // Use lighter model for Meta
      messages: [
        { role: 'user', content: metaPrompt }
      ],
      response_format: { type: 'json_object' },
    });

    const metaResult = JSON.parse(metaCompletion.choices[0]?.message?.content || '{}');

    // Process Tags
    const knownTagsMap: Record<string, string> = {}; 
    originalTagSlugs.forEach((slug) => {
       const dictName = getTagName(blogTheme, slug, targetLang);
       if (dictName) knownTagsMap[slug] = dictName;
    });

    const gptGeneratedTagsMap = metaResult.translated_tags || {};
    const finalTags: string[] = originalTagSlugs.map(slug => {
      if (knownTagsMap[slug]) return knownTagsMap[slug]; 
      if (gptGeneratedTagsMap[slug]) return gptGeneratedTagsMap[slug]; 
      return slug;
    });

    // Update Page Properties
    const updateProps: any = {
      'meta-title': {
        rich_text: [{ text: { content: metaResult.meta_title || '' } }],
      },
      Description: {
        rich_text: [{ text: { content: metaResult.description || '' } }],
      },
      Keywords: {
        rich_text: [{ text: { content: metaResult.keywords || '' } }],
      },
      Tag: {
        multi_select: finalTags.map((t: string) => ({ name: t })), 
      },
      Published: {
        checkbox: true, 
      },
    };

    await notion.pages.update({
        page_id: pageId,
        properties: updateProps
    });

    return { success: true, meta: metaResult };
}

export async function translateArticle(
  sourcePageId: string,
  targetLang: 'en' | 'zh-hant',
  blogTheme: string
) {
  console.log(`🌍 Translating ${sourcePageId} to ${targetLang} (${blogTheme}) using Block Cloning...`);

  try {
    // 1. Fetch Source Page Properties (Keep this for Meta/Tags)
    const sourcePage = await notion.pages.retrieve({ page_id: sourcePageId }) as any;
    const props = sourcePage.properties;

    // Inherit Fields
    const title = props.Title?.title[0]?.plain_text || '';
    const slug = props.Slug?.rich_text[0]?.plain_text || '';
    const coverUrl = props.Cover?.url || null;
    const tagSlug = (props['tag-slug']?.multi_select || []).map((t: any) => ({ name: t.name }));
    const section = props.Section?.select?.name || 'playfish';
    const sourceId = props.SourceID?.rich_text[0]?.plain_text || '';
    const draftId = props.DraftID?.rich_text[0]?.plain_text || '';
    const publicationDate = props.PublicationDate?.date?.start || null;
    
    // --- BLOCK TRANSLATION PIPELINE ---
    
    // A. Fetch Source Block Tree
    console.log('Step A: Fetching Block Tree...');
    const sourceBlocks = await fetchBlockTree(sourcePageId);
    
    // B. Extract Text Nodes
    console.log('Step B: Extracting Texts...');
    const rawTexts = collectTextNodes(sourceBlocks);
    // Add Title to translation batch (it's not in blocks)
    rawTexts.unshift(title); 
    
    // C. Translate Batch
    console.log(`Step C: Translating ${rawTexts.length} segments...`);
    const translatedTexts = await translateTexts(rawTexts, targetLang);
    
    // Extract translated Title (first item)
    const translatedTitle = translatedTexts.shift() || title;
    
    // D. Reconstruct Blocks
    console.log('Step D: Reconstructing Blocks...');
    const newContentBlocks = reconstructBlocks(sourceBlocks, translatedTexts);

    // --- SEO META GENERATION (Keep existing logic but simplify source) ---
    console.log('Step E: Generating Meta...');
    
    // We use the first 3000 chars of translated text for Meta generation context
    const contextText = translatedTexts.join('\n').substring(0, 3000);
    const sourceTagSlugs: string[] = (props['tag-slug']?.multi_select || []).map((t: any) => t.name);

    const metaPrompt = PROMPTS.PF_GENERATE_META
      .replace('{{TARGET_LANG}}', targetLang === 'en' ? 'English' : 'Traditional Chinese')
      .replace('{{TITLE}}', translatedTitle)
      .replace('{{CONTENT_PREVIEW}}', contextText.replace(/\n/g, ' ')) 
      .replace('{{ORIGINAL_TAGS}}', JSON.stringify(sourceTagSlugs));

    const metaCompletion = await openai.chat.completions.create({
      model: MODELS.SEO, // Use lighter model for Meta
      messages: [
        { role: 'user', content: metaPrompt }
      ],
      response_format: { type: 'json_object' },
    });

    const metaResult = JSON.parse(metaCompletion.choices[0]?.message?.content || '{}');

    // Process Tags
    const knownTagsMap: Record<string, string> = {}; 
    sourceTagSlugs.forEach((slug) => {
       const dictName = getTagName(blogTheme, slug, targetLang);
       if (dictName) knownTagsMap[slug] = dictName;
    });

    const gptGeneratedTagsMap = metaResult.translated_tags || {};
    const finalTags: string[] = sourceTagSlugs.map(slug => {
      if (knownTagsMap[slug]) return knownTagsMap[slug]; 
      if (gptGeneratedTagsMap[slug]) return gptGeneratedTagsMap[slug]; 
      return slug;
    });

    // --- FINAL WRITE ---
    console.log('Step F: Writing New Page...');
    const targetDbId = getDbIdByTheme(blogTheme);
    
    const newPageProperties: any = {
      Title: {
        title: [{ text: { content: translatedTitle } }],
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
        rich_text: [{ text: { content: slug } }], 
      },
      'meta-title': {
        rich_text: [{ text: { content: metaResult.meta_title || '' } }],
      },
      Description: {
        rich_text: [{ text: { content: metaResult.description || '' } }],
      },
      Keywords: {
        rich_text: [{ text: { content: metaResult.keywords || '' } }],
      },
      Tag: {
        multi_select: finalTags.map((t: string) => ({ name: t })), 
      },
      'tag-slug': {
        multi_select: tagSlug, 
      },
      Section: {
        select: { name: section }, 
      },
      Published: {
        checkbox: true, 
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

    // Create Page with Initial Blocks (Slice if too big? Notion create limit is 100)
    // reconstructBlocks returns full array. We need to slice.
    const CHUNK_SIZE = 100;
    const initialBlocks = newContentBlocks.slice(0, CHUNK_SIZE);
    const remainingBlocks = newContentBlocks.slice(CHUNK_SIZE);

    const newPage = await notion.pages.create({
      parent: { database_id: targetDbId },
      properties: newPageProperties,
      children: initialBlocks,
    });

    // Append Remaining
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
    tasks.sort((a, b) => new Date(b.publishedDate).getTime() - new Date(a.publishedDate).getTime());
    
    const task = tasks[0];
    const targetLang = task.missingLangs[0]; 

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
