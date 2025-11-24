import { notion } from '@/lib/notion/client';
import { TAG_DEFINITIONS } from '@/lib/constants/tags';

const TAG_DB_ID = process.env.NOTION_TAG_SYSTEM_DB_ID;

export type TagEntry = {
  slug: string;
  'zh-hans': string;
  'en': string;
  'zh-hant': string;
};

export async function getTagDictionary(): Promise<Record<string, TagEntry>> {
  // 1. If no DB ID, fallback to static file
  if (!TAG_DB_ID) {
    console.warn('⚠️ NOTION_TAG_SYSTEM_DB_ID not set. Using static tag definitions.');
    const dict: Record<string, TagEntry> = {};
    Object.values(TAG_DEFINITIONS).flat().forEach(def => {
      dict[def.slug] = def;
    });
    return dict;
  }

  // 2. Fetch from Notion
  try {
    // Handle pagination to fetch ALL tags
    let allResults: any[] = [];
    let hasMore = true;
    let cursor: string | undefined = undefined;

    while (hasMore) {
      const response = await notion.databases.query({
        database_id: TAG_DB_ID,
        page_size: 100,
        start_cursor: cursor,
      });
      
      allResults = [...allResults, ...response.results];
      hasMore = response.has_more;
      cursor = response.next_cursor || undefined;
    }

    const dict: Record<string, TagEntry> = {};
    
    allResults.forEach((page: any) => {
      const slug = page.properties['tag-slug']?.title[0]?.plain_text;
      if (!slug) return;

      dict[slug] = {
        slug,
        'zh-hans': page.properties['tag-name-hans']?.rich_text[0]?.plain_text || '',
        'en': page.properties['tag-name-en']?.rich_text[0]?.plain_text || '',
        'zh-hant': page.properties['tag-name-hant']?.rich_text[0]?.plain_text || '',
      };
    });

    // 3. Auto-Seed if empty logic can be added here or via manual trigger
    // For now, if DB is empty, we might want to fallback to static OR return empty.
    // Let's return mixed: Static + DB?
    // Safer: If DB is empty, log warning. User should run a seed script.
    // Actually, let's just merge Static (Base) + DB (Overrides/Extensions).
    // This ensures basic system tags always exist even if DB is empty.
    const staticDict: Record<string, TagEntry> = {};
    Object.values(TAG_DEFINITIONS).flat().forEach(def => {
      staticDict[def.slug] = def;
    });

    return { ...staticDict, ...dict };

  } catch (error) {
    console.error('Failed to fetch tags from Notion:', error);
    // Fallback
    const dict: Record<string, TagEntry> = {};
    Object.values(TAG_DEFINITIONS).flat().forEach(def => {
      dict[def.slug] = def;
    });
    return dict;
  }
}

export async function saveNewTag(entry: TagEntry) {
  if (!TAG_DB_ID) {
    console.warn('⚠️ NOTION_TAG_SYSTEM_DB_ID not set. Cannot save new tag.');
    return;
  }
  
  console.log(`💾 Saving new tag to dictionary: ${entry.slug}`);
  
  try {
    // Check if exists first to avoid duplicates
    const existing = await notion.databases.query({
        database_id: TAG_DB_ID,
        filter: {
            property: 'tag-slug',
            title: { equals: entry.slug }
        }
    });
    
    if (existing.results.length > 0) {
        const page = existing.results[0] as any;
        const props = page.properties;
        const updates: any = {};

        // Update Logic: Only update if provided value is non-empty and different/missing
        if (entry['zh-hans']) {
            const current = props['tag-name-hans']?.rich_text[0]?.plain_text || '';
            if (current !== entry['zh-hans']) {
                updates['tag-name-hans'] = { rich_text: [{ text: { content: entry['zh-hans'] } }] };
            }
        }
        if (entry.en) {
            const current = props['tag-name-en']?.rich_text[0]?.plain_text || '';
            if (current !== entry.en) {
                updates['tag-name-en'] = { rich_text: [{ text: { content: entry.en } }] };
            }
        }
        if (entry['zh-hant']) {
            const current = props['tag-name-hant']?.rich_text[0]?.plain_text || '';
            if (current !== entry['zh-hant']) {
                updates['tag-name-hant'] = { rich_text: [{ text: { content: entry['zh-hant'] } }] };
            }
        }

        if (Object.keys(updates).length > 0) {
            await notion.pages.update({
                page_id: page.id,
                properties: updates
            });
            console.log(`🔄 Tag ${entry.slug} updated.`);
        } else {
            console.log(`Tag ${entry.slug} is up to date.`);
        }
        return;
    }

    await notion.pages.create({
      parent: { database_id: TAG_DB_ID },
      properties: {
        'tag-slug': { title: [{ text: { content: entry.slug } }] },
        'tag-name-hans': { rich_text: [{ text: { content: entry['zh-hans'] || '' } }] },
        'tag-name-en': { rich_text: [{ text: { content: entry.en || '' } }] },
        'tag-name-hant': { rich_text: [{ text: { content: entry['zh-hant'] || '' } }] },
      }
    });
    console.log(`✅ Tag ${entry.slug} saved to Notion.`);
  } catch (error) {
    console.error(`❌ Failed to save tag ${entry.slug}:`, error);
  }
}

