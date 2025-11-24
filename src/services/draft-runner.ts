import { notion, DB_IDS, getPageContent, PageContent, appendBlocksToPage } from '@/lib/notion/client';
import { openai, MODELS, ChatMessage } from '@/lib/openai/client';
import { PROMPTS } from '@/lib/openai/prompts';
import { nanoid } from 'nanoid';
import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
import { generateAndUploadCover } from '@/services/image-runner';
import { markdownToBlocks } from '@/lib/notion/markdown';

const BLOG_TAGS = {
  Playfish: [
    '摸鱼艺术 (art-of-fish)',
    '时间管理 (time-management)',
  ],
  Immigrant: [
    '亚洲 (asia)',
    '欧洲 (eu)',
    '北美 (na)',
    '澳洲 (au)',
  ],
  FIRE: [
    '什么是FIRE (what-is-fire)',
    '生活成本 (living-cost)',
    '理财规划 (financial-planning)',
    '医疗保险 (health-insurance)',
    '中产焦虑 (middle-class-anxiety)',
    '风险管理 (risk-management)',
  ]
};

type DraftResult = {
  processed: number;
  errors?: string[];
  message?: string;
  warning?: string;
  results?: Array<{
    title: string;
    targetBlog: string;
    draftId: string;
    sourceId: string;
    coverUrl?: string;
  }>;
};

export async function runDraftRunner(options?: { limit?: number, skipImage?: boolean }): Promise<DraftResult> {
  console.log('Starting Draft Runner...');
  
  // Default limit is processed all, but if limit is provided (e.g. 1 for Cron), use it.
  const { limit, skipImage } = options || {};

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
    // If limit is provided, we fetch a bit more just in case, but processing loop will stop
    page_size: limit ? limit + 5 : 100,
  });

  const pages = response.results;
  console.log(`Found ${pages.length} pending pages in Source DB.`);

  if (pages.length === 0) {
    return { processed: 0, message: 'No pending drafts found' };
  }

  let processedCount = 0;
  const errors: string[] = [];
  const results: Array<{ title: string; targetBlog: string; draftId: string; sourceId: string; coverUrl?: string }> = [];

  for (const page of pages) {
    // Enforce limit check at start of loop
    if (limit && processedCount >= limit) {
      console.log(`Limit of ${limit} processed items reached. Stopping.`);
      break;
    }

    const p = page as any;
    const pageId = p.id;
    const sourceTitle = p.properties.Title?.title[0]?.plain_text || 'Untitled Source';
    
    // Get SourceID safely
    const sourceIdProp = p.properties.SourceID || p.properties.sourceid; // try case insensitive
    const sourceId = sourceIdProp?.rich_text[0]?.plain_text || `src_${nanoid(8)}`;

    // Get Manual TargetBlog if exists
    const manualTargetBlog = p.properties.TargetBlog?.select?.name;

    console.log(`Processing Source Page: ${sourceTitle} (${pageId}) ${manualTargetBlog ? `[Target: ${manualTargetBlog}]` : ''}`);

    try {
      // 2. Get Content (Text + Images)
      const content: PageContent = await getPageContent(pageId);
      
      // Combine text and image URLs for the prompt
      let promptContent = `Title: ${sourceTitle}\n\nContent:\n${content.text}`;
      
      if (manualTargetBlog) {
        promptContent += `\n\n[IMPORTANT INSTRUCTION]\nUser has explicitly assigned this content to the "${manualTargetBlog}" blog theme. Please ensure the writing style, tone, and audience analysis (STEP 1) are perfectly tailored for the "${manualTargetBlog}" theme.`;
      }

      if (content.imageUrls.length > 0) {
        promptContent += `\n\n[Image Content Available: ${content.imageUrls.length} images found but not directly processed in text rewrite step unless Vision model used. For now, rely on text extraction if any.]`;
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
      // Priority: Manual TargetBlog > AI Detected > Default
      const targetBlog = manualTargetBlog || draftData.targetBlog || 'Playfish';

      console.log(`Draft Generated. Target: ${targetBlog} ${manualTargetBlog ? '(Manual Override)' : '(AI Detected)'}`);

      // 4. Create Entry in Draft DB
      console.log('Writing to Draft DB...');
      
      // Combine all content
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
      
      // Parse Markdown to Blocks
      const contentBlocks = markdownToBlocks(fullContent);
      const initialDraftBlocks = contentBlocks.slice(0, 100);
      const remainingDraftBlocks = contentBlocks.slice(100);
      
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
        children: initialDraftBlocks,
      });

      if (remainingDraftBlocks.length > 0) {
         await appendBlocksToPage(draftPage.id, remainingDraftBlocks);
      }

      // 5. Determine Target Blog DB ID
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
      
      // Select available tags based on blogTheme
      const availableTags = BLOG_TAGS[blogTheme as keyof typeof BLOG_TAGS] || [];

      // Determine Section based on targetBlog (for website routing)
      let sectionValue = 'playfish';
      if (targetBlog === 'FIRE') sectionValue = 'fire';
      else if (targetBlog === 'Immigrant') sectionValue = 'immigrant';
      else if (targetBlog === 'Playfish') sectionValue = 'playfish';

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
              AvailableTags: availableTags.join(', '),
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
        Keywords: '',
        Tag: [],
        'tag-slug': ''
      };

      // 7. Create Entry in Blog DB
      console.log(`Writing to Blog DB (${targetBlog})...`);
      
      const blogContentBlocks = markdownToBlocks(draftData.draft || '');
      const initialBlogBlocks = blogContentBlocks.slice(0, 100);
      const remainingBlogBlocks = blogContentBlocks.slice(100);

      const blogPage = await notion.pages.create({
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
          Tag: {
            multi_select: (Array.isArray(seoData.Tag) ? seoData.Tag : []).map((t: string) => ({ name: t })),
          },
          'tag-slug': {
            multi_select: (() => {
              const tagSlugStr = seoData['tag-slug'] || seoData.TagSlug || '';
              if (!tagSlugStr) return [];
              // Split by comma and trim each slug
              return tagSlugStr.split(',').map((slug: string) => ({ name: slug.trim() }));
            })(),
          },
          Section: {
            select: { name: sectionValue },
          },
        },
        children: initialBlogBlocks,
      });

      if (remainingBlogBlocks.length > 0) {
         await appendBlocksToPage(blogPage.id, remainingBlogBlocks);
      }

      // 8. Update Source DB (Mark as Used) FIRST to prevent duplicate processing if image gen timeouts
      console.log('Updating Source DB (Used=true)...');
      await notion.pages.update({
        page_id: pageId,
        properties: {
          Used: {
            checkbox: true,
          },
        },
      });

      // 9. Try Generate Cover Image (Optional, based on config)
      let coverUrl: string | undefined;
      if (!skipImage) {
        console.log('Attempting to generate cover image...');
        const imageResult = await generateAndUploadCover(
          blogPage.id,
          articleTitle,
          blogTheme,
          seoData.Keywords || ''
        );
        
        if (imageResult.success) {
          coverUrl = imageResult.url;
          console.log('Cover image generated successfully');
        } else {
          console.warn('Cover image generation failed, but Draft flow continues:', imageResult.error);
          // We do NOT fail the whole process if image fails
        }
      } else {
        console.log('Skipping cover image generation as requested.');
      }

      processedCount++;
      console.log('Draft Flow Completed for page ' + pageId);
      
      results.push({
        title: articleTitle,
        targetBlog: targetBlog,
        draftId: draftId,
        sourceId: sourceId,
        coverUrl: coverUrl,
      });

    } catch (error: any) {
      console.error(`Failed to process page ${pageId}:`, error);
      errors.push(`Page ${pageId}: ${error.message}`);
    }
  }

  return { 
    processed: processedCount, 
    errors: errors.length > 0 ? errors : undefined,
    results: results.length > 0 ? results : undefined,
  };
}
