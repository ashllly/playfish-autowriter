import { notion, DB_IDS, getPageContent, PageContent } from '@/lib/notion/client';
import { openai, MODELS, ChatMessage } from '@/lib/openai/client';
import { PROMPTS } from '@/lib/openai/prompts';
import { nanoid } from 'nanoid';

type DraftResult = {
  processed: number;
  errors?: string[];
  message?: string;
  warning?: string;
};

export async function runDraftRunner(): Promise<DraftResult> {
  console.log('Starting Draft Runner...');

  // 1. Query Source DB for Send=true AND Used=false
  const sourceDbId = process.env.NOTION_BLOG_SOURCE_DB_ID;
  if (!sourceDbId) throw new Error('NOTION_BLOG_SOURCE_DB_ID missing');

  const response = await notion.databases.query({
    database_id: sourceDbId,
    filter: {
      and: [
        {
          property: 'Send',
          checkbox: {
            equals: true,
          },
        },
        {
          property: 'Used',
          checkbox: {
            equals: false,
          },
        },
      ],
    },
  });

  const pages = response.results;
  console.log(`Found ${pages.length} pending pages in Source DB.`);

  if (pages.length === 0) {
    return { processed: 0, message: 'No pending drafts found' };
  }

  let processedCount = 0;
  const errors: string[] = [];

  for (const page of pages) {
    const p = page as any;
    const pageId = p.id;
    const sourceTitle = p.properties.Title?.title[0]?.plain_text || 'Untitled Source';
    
    // Get SourceID safely
    const sourceIdProp = p.properties.SourceID || p.properties.sourceid; // try case insensitive
    const sourceId = sourceIdProp?.rich_text[0]?.plain_text || `src_${nanoid(8)}`;

    console.log(`Processing Source Page: ${sourceTitle} (${pageId})`);

    try {
      // 2. Get Content (Text + Images)
      const content: PageContent = await getPageContent(pageId);
      
      // Combine text and image URLs for the prompt
      let promptContent = `Title: ${sourceTitle}\n\nContent:\n${content.text}`;
      if (content.imageUrls.length > 0) {
        promptContent += `\n\n[Image Content Available: ${content.imageUrls.length} images found but not directly processed in text rewrite step unless Vision model used. For now, rely on text extraction if any.]`;
        // Note: Ideally we would use Vision here too if the text is empty, 
        // but for now we rely on the text content or title. 
        // If content is empty, we might skip or use title only.
      }

      if (!content.text.trim() && content.imageUrls.length === 0) {
        console.warn(`Page ${pageId} has no content. Skipping.`);
        continue;
      }

      // 3. Call OpenAI (PF-Rewrite)
      console.log('Generating Draft (PF-Rewrite)...');
      const completion = await openai.chat.completions.create({
        model: MODELS.REWRITE, // GPT-4-Turbo or GPT-4o
        messages: [
          { role: 'system', content: PROMPTS.PF_REWRITE },
          { role: 'user', content: promptContent },
        ],
        response_format: { type: 'json_object' }, // Enforce JSON
      });

      const draftJsonStr = completion.choices[0]?.message?.content;
      if (!draftJsonStr) {
        throw new Error('Empty response from OpenAI');
      }

      const draftData = JSON.parse(draftJsonStr);
      // Expected: { angle, outline, draft, thinkLog, targetBlog }

      const draftId = `draft_${nanoid(8)}`;
      // targetBlog values: "Playfish", "FIRE", "Immigrant" (matching Notion DB names)
      const targetBlog = draftData.targetBlog || 'Playfish'; // Default fallback

      console.log(`Draft Generated. Target: ${targetBlog}`);

      // 4. Create Entry in Draft DB
      console.log('Writing to Draft DB...');
      
      // Combine all content into a single article (like Notion Article)
      // Format: Angle + Outline + Draft + ThinkLog (all in one continuous content)
      const fullContent = [
        '# 角度分析',
        draftData.angle || 'N/A',
        '',
        '# 大纲',
        draftData.outline || 'N/A',
        '',
        '# 正文',
        draftData.draft || 'N/A',
        '',
        '---',
        '',
        '## 思考日志',
        draftData.thinkLog || 'N/A',
      ].join('\n');
      
      // Split content into blocks (Notion has 2000 char limit per block)
      // Explicitly type as any[] to avoid TS inference issues with Notion API types
      const contentBlocks: any[] = [];
      const MAX_CHUNK_LENGTH = 1800;
      for (let i = 0; i < fullContent.length; i += MAX_CHUNK_LENGTH) {
        contentBlocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: fullContent.substring(i, i + MAX_CHUNK_LENGTH) } }],
          },
        });
      }
      
      const draftDbId = process.env.NOTION_BLOG_AUTO_DRAFT_DB_ID;
      if (!draftDbId) throw new Error('NOTION_BLOG_AUTO_DRAFT_DB_ID missing');

      const draftPage = await notion.pages.create({
        parent: { database_id: draftDbId },
        properties: {
          Title: {
            title: [{ text: { content: draftData.outline?.split('\n')[0]?.replace(/^#+\s*/, '') || sourceTitle } }],
          },
          TargetBlog: {
            select: { name: targetBlog },
          },
          SourceID: {
            rich_text: [{ text: { content: sourceId } }],
          },
          DraftID: {
            rich_text: [{ text: { content: draftId } }],
          },
        },
        children: contentBlocks,
      });

      // 5. Determine Target Blog DB ID
      // Map targetBlog values to Notion DB IDs:
      // "Playfish" -> Blog-Playfish
      // "FIRE" -> Blog-FIRE
      // "Immigrant" -> Blog-Immigrant
      let targetDbId = process.env.NOTION_PLAYFISH_DB_ID; // Default
      
      if (targetBlog === 'FIRE') targetDbId = process.env.NOTION_FIRE_DB_ID;
      if (targetBlog === 'Immigrant') targetDbId = process.env.NOTION_IMMIGRATION_DB_ID;
      if (targetBlog === 'Playfish') targetDbId = process.env.NOTION_PLAYFISH_DB_ID;

      console.log(`Target Blog: ${targetBlog} | Target DB ID: ${targetDbId}`);

      if (!targetDbId) {
        throw new Error(`Target Database ID not found for blog theme: "${targetBlog}". Check environment variables (NOTION_..._DB_ID).`);
      }

      // 6. Generate SEO (PF-SEO)
      console.log('Generating SEO (PF-SEO)...');
      
      // Extract article title from outline
      const articleTitle = draftData.outline?.split('\n')[0]?.replace(/^#+\s*/, '') || sourceTitle;
      const articleContent = draftData.draft || '';
      
      // Extract keywords from angle/thinkLog (if available)
      // For now, we'll pass empty HotKeywords, but PF-SEO can extract from content
      const hotKeywords = ''; // Can be enhanced later to extract from angle/thinkLog
      const blogTheme = targetBlog; // Playfish, FIRE, or Immigrant
      
      const seoCompletion = await openai.chat.completions.create({
        model: MODELS.SEO,
        messages: [
          { role: 'system', content: PROMPTS.PF_SEO },
          { 
            role: 'user', 
            content: JSON.stringify({
              ArticleTitle: articleTitle,
              ArticleContent: articleContent.substring(0, 5000), // Limit content length
              HotKeywords: hotKeywords,
              BlogTheme: blogTheme,
              OptionalNotes: ''
            }, null, 2)
          },
        ],
        response_format: { type: 'json_object' },
      });
      
      const seoJsonStr = seoCompletion.choices[0]?.message?.content;
      const seoData = seoJsonStr ? JSON.parse(seoJsonStr) : { 
        Slug: '', 
        'meta-title': '', 
        Description: '', 
        Keywords: '' 
      };

      // 7. Create Entry in Blog DB
      console.log(`Writing to Blog DB (${targetBlog})...`);
      
      // Need to split draft content into blocks (Notion has 2000 char limit per block)
      // For simplicity, we'll put the whole draft in one or few paragraph blocks.
      // Better implementation would parse Markdown to Blocks, but for now simple text.
      const blogContentBlocks: any[] = [];
      // Reusing MAX_CHUNK_LENGTH from above
      const draftText = draftData.draft || '';
      for (let i = 0; i < draftText.length; i += MAX_CHUNK_LENGTH) {
        blogContentBlocks.push({
          object: 'block',
          type: 'paragraph',
          paragraph: {
            rich_text: [{ text: { content: draftText.substring(i, i + MAX_CHUNK_LENGTH) } }],
          },
        });
      }

      await notion.pages.create({
        parent: { database_id: targetDbId },
        properties: {
          Title: {
            title: [{ text: { content: draftData.outline?.split('\n')[0]?.replace(/^#+\s*/, '') || sourceTitle } }],
          },
          Lang: {
            select: { name: 'zh-hans' },
          },
          SourceID: {
            rich_text: [{ text: { content: sourceId } }],
          },
          DraftID: {
            rich_text: [{ text: { content: draftId } }],
          },
          Slug: {
            rich_text: [{ text: { content: seoData.Slug || '' } }],
          },
          'meta-title': {
            rich_text: [{ text: { content: seoData['meta-title'] || '' } }],
          },
          Description: {
            rich_text: [{ text: { content: seoData.Description || '' } }],
          },
          Keywords: {
            rich_text: [{ text: { content: seoData.Keywords || '' } }],
          },
        },
        children: blogContentBlocks,
      });

      // 8. Update Source DB (Mark as Used)
      console.log('Updating Source DB (Used=true)...');
      await notion.pages.update({
        page_id: pageId,
        properties: {
          Used: {
            checkbox: true,
          },
        },
      });

      processedCount++;
      console.log('Draft Flow Completed for page ' + pageId);

    } catch (error: any) {
      console.error(`Failed to process page ${pageId}:`, error);
      errors.push(`Page ${pageId}: ${error.message}`);
    }
  }

  return { 
    processed: processedCount, 
    errors: errors.length > 0 ? errors : undefined 
  };
}

