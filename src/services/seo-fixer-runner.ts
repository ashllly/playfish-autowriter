import { notion, getPageContent } from '@/lib/notion/client';
import { openai, MODELS } from '@/lib/openai/client';
import { PROMPTS } from '@/lib/openai/prompts';
import { generateAndUploadCover, generateCoverAltPlan } from '@/services/image-runner';
import { nanoid } from 'nanoid';

// Re-use tag definitions from draft-runner
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

function normalizePropName(name: string): string {
  return name.toLowerCase().replace(/[\s_-]/g, '');
}

type SeoFixResult = {
  processed: number;
  scannedCount: number; // New: Total pages scanned/found
  logs: string[];       // New: Execution logs
  results: Array<{
    pageId: string;
    title: string;
    fixes: string[];
    error?: string;
  }>;
};

export async function runSeoFixerRunner(options?: { targetDb?: 'Playfish' | 'FIRE' | 'Immigrant' }): Promise<SeoFixResult> {
  console.log('Starting SEO Fixer Runner...');
  
  const results: SeoFixResult['results'] = [];
  const logs: string[] = [];
  let processedCount = 0;
  let scannedCount = 0;

  // 1. Identify Target DBs
  const targetDbs: Array<{ name: string; id: string }> = [];
  
  if (options?.targetDb) {
    // Single DB mode
    let dbId = '';
    if (options.targetDb === 'Playfish') dbId = process.env.NOTION_PLAYFISH_DB_ID || '';
    if (options.targetDb === 'FIRE') dbId = process.env.NOTION_FIRE_DB_ID || '';
    if (options.targetDb === 'Immigrant') dbId = process.env.NOTION_IMMIGRATION_DB_ID || '';
    
    if (dbId) targetDbs.push({ name: options.targetDb, id: dbId });
  } else {
    // All DBs mode
    if (process.env.NOTION_PLAYFISH_DB_ID) targetDbs.push({ name: 'Playfish', id: process.env.NOTION_PLAYFISH_DB_ID });
    if (process.env.NOTION_FIRE_DB_ID) targetDbs.push({ name: 'FIRE', id: process.env.NOTION_FIRE_DB_ID });
    if (process.env.NOTION_IMMIGRATION_DB_ID) targetDbs.push({ name: 'Immigrant', id: process.env.NOTION_IMMIGRATION_DB_ID });
  }

  logs.push(`Targets identified: ${targetDbs.map(d => d.name).join(', ')}`);

  // 2. Scan each DB for missing metadata
  for (const db of targetDbs) {
    console.log(`Scanning DB: ${db.name} (${db.id})...`);
    logs.push(`Scanning DB: ${db.name}...`);

    // Retrieve DB schema to check optional properties
    const dbSchema = await notion.databases.retrieve({ database_id: db.id });
    const dbProperties = (dbSchema as any).properties || {};
    let coverAltPropName: string | null = null;
    let sectionPropName: string | null = null;
    for (const key of Object.keys(dbProperties)) {
      const norm = normalizePropName(key);
      if (!coverAltPropName && norm === 'coveralt') {
        coverAltPropName = key;
      }
      if (!sectionPropName && norm === 'section') {
        sectionPropName = key;
      }
    }
    const hasCoverAltProp = Boolean(coverAltPropName);
    const hasSectionProp = Boolean(sectionPropName);
    if (!hasCoverAltProp) {
      console.warn(`⚠️  ${db.name} DB missing Cover-alt-like property. Skipping Cover-alt fixes for this DB.`);
      logs.push(`⚠️  ${db.name}: Cover-alt property missing, skipping alt fixes`);
    }
    
    // Query for pages where ANY required field is empty
    // Notion API limitation: 'or' filter at top level
    const filters: any[] = [
      { property: 'Slug', rich_text: { is_empty: true } },
      { property: 'Description', rich_text: { is_empty: true } },
      { property: 'meta-title', rich_text: { is_empty: true } },
      { property: 'Keywords', rich_text: { is_empty: true } },
      { property: 'Tag', multi_select: { is_empty: true } },
      { property: 'tag-slug', multi_select: { is_empty: true } },
      { property: 'Cover', url: { is_empty: true } },
    ];
    if (hasCoverAltProp && coverAltPropName) {
      filters.splice(filters.length - 1, 0, {
        property: coverAltPropName,
        rich_text: { is_empty: true },
      });
    }
    if (hasSectionProp && sectionPropName) {
      filters.push({
        property: sectionPropName,
        select: { is_empty: true },
      });
    }

    const response = await notion.databases.query({
      database_id: db.id,
      filter: {
        or: filters,
      },
      page_size: 5, // Process in small batches to avoid timeouts
    });

    const pages = response.results;
    scannedCount += pages.length;
    console.log(`Found ${pages.length} pages needing fixes in ${db.name}.`);
    logs.push(`Found ${pages.length} pages in ${db.name}`);

    for (const page of pages) {
      const p = page as any;
      const pageId = p.id;
      const titleRich = p.properties.Title?.title || [];
      const titleText = titleRich.map((t: any) => t.plain_text || '').join('').trim();
      const title = titleText || 'Untitled';

      if (!titleText) {
        console.warn(`Skipping page ${pageId}: Title is empty`);
        logs.push(`Skipped: ${pageId} (title empty)`);
        continue;
      }
      
      const fixes: string[] = [];
      let contentPreview = '';
      
      console.log(`Fixing Page: ${title} (${pageId})`);
      logs.push(`Processing: ${title}`);

      try {
        const pageContent = await getPageContent(pageId);
        const fullContentText = pageContent.text?.trim() || '';
        const contentLength = fullContentText.length;
        // 仅当正文长度 >= 300 字时，才认为文章已完成，可以补全 SEO / 封面
        if (contentLength < 300) {
          console.warn(`Skipping page ${pageId}: Content too short (${contentLength} chars)`);
          logs.push(`Skipped: ${title} (content too short: ${contentLength} chars, < 300)`); 
          continue;
        }
        contentPreview = fullContentText.substring(0, 5000);

        // Check what's missing
        const isSlugMissing = !p.properties.Slug?.rich_text?.[0];
        const isDescMissing = !p.properties.Description?.rich_text?.[0];
        const isMetaTitleMissing = !p.properties['meta-title']?.rich_text?.[0];
        const isKeywordsMissing = !p.properties.Keywords?.rich_text?.[0];
        const isTagMissing =
          !p.properties.Tag?.multi_select || p.properties.Tag.multi_select.length === 0;
        const isTagSlugMissing =
          !p.properties['tag-slug']?.multi_select ||
          p.properties['tag-slug'].multi_select.length === 0;
        const existingCoverAlt =
          hasCoverAltProp && coverAltPropName
            ? (p.properties[coverAltPropName]?.rich_text || [])
                .map((t: any) => t.plain_text || '')
                .join('')
                .trim()
            : '';
        const isCoverAltMissing = hasCoverAltProp ? existingCoverAlt.length === 0 : false;
        const hasSectionValue =
          hasSectionProp && sectionPropName
            ? Boolean(p.properties[sectionPropName]?.select?.name)
            : false;
        
        const coverUrlProp = p.properties.Cover?.url;
        // 只以字段 Cover 是否为空为准，不再因为页面顶部已有 Notion 封面而跳过
        const isCoverMissing = !coverUrlProp || coverUrlProp.trim() === '';
        const isSourceIdMissing = !p.properties.SourceID?.rich_text?.[0];
        const isDraftIdMissing = !p.properties.DraftID?.rich_text?.[0];

        const needsSeoGen =
          isSlugMissing ||
          isDescMissing ||
          isMetaTitleMissing ||
          isKeywordsMissing ||
          isTagMissing ||
          isTagSlugMissing;
        let seoData: any = {};
        let keywordsForCover = p.properties.Keywords?.rich_text?.[0]?.plain_text || '';
        const needsCoverAssets = isCoverMissing || (hasCoverAltProp && isCoverAltMissing);

        // A. Generate SEO Data (if needed)
        if (needsSeoGen) {
           console.log('Generating missing SEO data...');
           
           // Call OpenAI
           const availableTags = BLOG_TAGS[db.name as keyof typeof BLOG_TAGS] || [];
           
           const seoCompletion = await openai.chat.completions.create({
            model: MODELS.SEO,
            messages: [
              { role: 'system', content: PROMPTS.PF_SEO },
              { 
                role: 'user', 
                content: JSON.stringify({
                  ArticleTitle: title,
                  ArticleContent: contentPreview,
                  HotKeywords: '', // Auto-extract
                  BlogTheme: db.name,
                  AvailableTags: availableTags.join(', '),
                  OptionalNotes: 'Fix missing metadata'
                }, null, 2)
              },
            ],
            response_format: { type: 'json_object' },
          });

          const seoJsonStr = seoCompletion.choices[0]?.message?.content;
          seoData = seoJsonStr ? JSON.parse(seoJsonStr) : {};
          if (seoData.Keywords) {
            keywordsForCover = seoData.Keywords;
          }
        }
        const coverPlan =
          needsCoverAssets
            ? await generateCoverAltPlan({
                title,
                blogTheme: db.name,
                summary: contentPreview,
                keywords: keywordsForCover,
              })
            : null;
        const coverAltText = coverPlan?.coverAlt || existingCoverAlt;
        const coverVisualPrompt = coverPlan?.imagePrompt;
        const coverShotType = coverPlan?.shotType;

        // B. Prepare Updates
        const updateProps: any = {};

        // 1. Fill SEO (Slug, Meta, Desc, Keywords, Tags)
        if (needsSeoGen) {
           if (isSlugMissing && seoData.Slug) {
             updateProps.Slug = { rich_text: [{ text: { content: seoData.Slug } }] };
             fixes.push('Slug');
           }
           if (isDescMissing && seoData.Description) {
             updateProps.Description = { rich_text: [{ text: { content: seoData.Description } }] };
             fixes.push('Description');
           }
           
           // Always try to update/fill others if we have fresh SEO data AND they are missing
           if (isMetaTitleMissing && seoData['meta-title']) {
              updateProps['meta-title'] = { rich_text: [{ text: { content: seoData['meta-title'] } }] };
              fixes.push('MetaTitle');
           }
           if (isKeywordsMissing && seoData.Keywords) {
              updateProps.Keywords = { rich_text: [{ text: { content: seoData.Keywords } }] };
              fixes.push('Keywords');
           }
           
           // Handle Tags (Multi-select)
           if (isTagMissing && seoData.Tag && Array.isArray(seoData.Tag)) {
             updateProps.Tag = { multi_select: seoData.Tag.map((t: string) => ({ name: t })) };
             fixes.push('Tags');
           }
           
           // Handle tag-slug (Multi-select)
           if (isTagSlugMissing && seoData['tag-slug']) {
              const tagSlugStr = seoData['tag-slug'] || '';
              // tag-slug is likely a string "slug1, slug2" from AI, need to convert to multi_select
              const tagSlugs = tagSlugStr.split(',').map((slug: string) => ({ name: slug.trim() }));
              updateProps['tag-slug'] = { multi_select: tagSlugs };
              fixes.push('TagSlug');
           }
        }

        // Cover Alt Text (independent of SEO generation)
        if (hasCoverAltProp && coverAltPropName && isCoverAltMissing && coverAltText) {
          updateProps[coverAltPropName] = {
            rich_text: [{ text: { content: coverAltText.slice(0, 200) } }],
          };
          fixes.push('CoverAlt');
        }

        // 2. Fill Missing Section (based on DB)
        if (hasSectionProp && sectionPropName && !hasSectionValue) {
          let sectionValue = 'playfish';
          if (db.name === 'FIRE') sectionValue = 'fire';
          else if (db.name === 'Immigrant') sectionValue = 'immigrant';
          else if (db.name === 'Playfish') sectionValue = 'playfish';
          updateProps[sectionPropName] = {
            select: { name: sectionValue },
          };
          fixes.push('Section');
        }

        // 3. Fill Missing IDs
        if (isSourceIdMissing) {
           updateProps.SourceID = { rich_text: [{ text: { content: `src_fixed_${nanoid(6)}` } }] };
           fixes.push('SourceID');
        }
        if (isDraftIdMissing) {
           updateProps.DraftID = { rich_text: [{ text: { content: `draft_fixed_${nanoid(6)}` } }] };
           fixes.push('DraftID');
        }

        // 4. Update Text Properties
        if (Object.keys(updateProps).length > 0) {
           await notion.pages.update({
             page_id: pageId,
             properties: updateProps,
           });
           console.log('Text properties updated.');
        }

        // 5. Generate Cover Image (Separate step due to latency)
        if (isCoverMissing) {
           console.log('Generating missing cover image...');
           logs.push(`Generating Cover: ${title}`);
           const imageResult = await generateAndUploadCover({
             pageId,
             title,
             blogTheme: db.name,
             coverAlt: coverAltText,
             visualPrompt: coverVisualPrompt,
             keywords: keywordsForCover,
             hasCoverAltProperty: hasCoverAltProp,
             shotType: coverShotType,
           });
           
           if (imageResult.success) {
             fixes.push('Cover');
             console.log('Cover image fixed.');
             logs.push(`Cover Fixed: ${title}`);
           } else {
             console.error('Cover generation failed:', imageResult.error);
             logs.push(`Cover Failed: ${imageResult.error}`);
           }
        }

        processedCount++;
        results.push({
          pageId,
          title,
          fixes,
        });

      } catch (error: any) {
        console.error(`Error fixing page ${pageId}:`, error);
        logs.push(`Error on ${title}: ${error.message}`);
        results.push({ pageId, title, fixes: [], error: error.message });
      }
    }
  }

  return { processed: processedCount, scannedCount, logs, results };
}

