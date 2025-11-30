import { notion } from '@/lib/notion/client';

// Cache structure: Map<Slug, { sourceId: string; lang: string; dbName: string }>
// Using a global map for process-level caching. In serverless, this might reset often, which is acceptable.
const slugMap = new Map<string, { sourceId: string; lang: string; dbName: string }>();
const sourceIdMap = new Map<string, { [lang: string]: string }>(); // SourceID -> Lang -> Slug

let isCacheWarm = false;

/**
 * Builds an in-memory map of all published articles for quick link resolution.
 * Should be called once before batch processing.
 */
export async function warmUpLinkCache() {
  if (isCacheWarm) return;
  console.log('🔄 Warming up internal link cache...');

  const dbIds = [
    { id: process.env.NOTION_PLAYFISH_DB_ID!, name: 'playfish' },
    { id: process.env.NOTION_FIRE_DB_ID!, name: 'fire' },
    { id: process.env.NOTION_IMMIGRATION_DB_ID!, name: 'immigrant' },
  ];

  for (const db of dbIds) {
    if (!db.id) continue;

    let hasMore = true;
    let cursor: string | undefined = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: db.id,
        filter: {
          property: 'Published',
          checkbox: { equals: true },
        },
        page_size: 100,
        start_cursor: cursor,
      });

      for (const page of response.results as any[]) {
        const slug = page.properties.Slug?.rich_text?.[0]?.plain_text;
        const sourceId = page.properties.SourceID?.rich_text?.[0]?.plain_text;
        const lang = page.properties.Lang?.select?.name;

        if (slug && sourceId && lang) {
          // Map 1: Slug lookup (finds identity)
          slugMap.set(slug, { sourceId, lang, dbName: db.name });

          // Map 2: SourceID lookup (finds relatives)
          if (!sourceIdMap.has(sourceId)) {
            sourceIdMap.set(sourceId, {});
          }
          sourceIdMap.get(sourceId)![lang] = slug;
        }
      }

      hasMore = response.has_more;
      cursor = response.next_cursor || undefined;
    }
  }

  isCacheWarm = true;
  console.log(`✅ Link cache warmed. Indexed ${slugMap.size} articles.`);
}

/**
 * Replaces internal links in Notion Block objects with their localized versions.
 */
export async function localizeInternalLinks(
  blocks: any[],
  targetLang: string
): Promise<any[]> {
  if (!isCacheWarm) await warmUpLinkCache();

  const domainRegex = /playfishlab\.com\/([^/]+)\/([^/]+)/; // Matches playfishlab.com/section/slug

  // Recursive function to traverse blocks
  function processBlock(block: any) {
    // 1. Process Rich Text (Paragraphs, Headings, Bullet lists etc.)
    const richText =
      block.paragraph?.rich_text ||
      block.heading_1?.rich_text ||
      block.heading_2?.rich_text ||
      block.heading_3?.rich_text ||
      block.bulleted_list_item?.rich_text ||
      block.numbered_list_item?.rich_text ||
      block.quote?.rich_text ||
      block.callout?.rich_text;

    if (richText && Array.isArray(richText)) {
      for (const textNode of richText) {
        if (textNode.href) {
          const match = textNode.href.match(domainRegex);
          if (match) {
            const originalSlug = match[2]; // Captured slug group
            
            // Core Logic:
            // 1. Find SourceID of original link
            const originalMeta = slugMap.get(originalSlug);
            
            if (originalMeta) {
              // 2. Find target lang slug for that SourceID
              const targetSlug = sourceIdMap.get(originalMeta.sourceId)?.[targetLang];
              
              if (targetSlug) {
                // 3. Construct new URL
                // Assuming route structure: playfishlab.com/[section]/[slug]
                // We keep the original section/dbName logic or infer from target? 
                // Usually section is tied to DB, so it stays same across languages.
                const newUrl = `https://playfishlab.com/${originalMeta.dbName}/${targetSlug}`;
                textNode.href = newUrl;
                // Optionally update text content if it matches the URL exactly
                // if (textNode.plain_text === textNode.href) textNode.text.content = newUrl;
                console.log(`🔗 Localized Link: ${originalSlug} -> ${targetSlug}`);
              }
            }
          }
        }
      }
    }

    // 2. Recursion for children
    if (block.children) {
      for (const child of block.children) {
        processBlock(child);
      }
    }
  }

  // Deep clone to avoid mutating original reference if needed, 
  // though typically we can mutate in place for this pipeline.
  const processedBlocks = JSON.parse(JSON.stringify(blocks));
  
  for (const block of processedBlocks) {
    processBlock(block);
  }

  return processedBlocks;
}

