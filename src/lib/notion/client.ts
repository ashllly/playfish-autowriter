import { Client } from '@notionhq/client';

// Lazy initialization to avoid build-time errors
let _notion: Client | null = null;

function getNotionClient(): Client {
  if (!_notion) {
    if (!process.env.NOTION_API_TOKEN) {
      throw new Error('NOTION_API_TOKEN is not defined in environment variables');
    }
    _notion = new Client({
      auth: process.env.NOTION_API_TOKEN,
    });
  }
  return _notion;
}

export const notion = new Proxy({} as Client, {
  get(_target, prop) {
    return getNotionClient()[prop as keyof Client];
  }
});

// Database IDs helper
export const DB_IDS = {
  SOURCE: process.env.NOTION_BLOG_SOURCE_DB_ID!,
  DRAFT: process.env.NOTION_BLOG_AUTO_DRAFT_DB_ID!,
  BLOG_PLAYFISH: process.env.NOTION_PLAYFISH_DB_ID!,
  BLOG_FIRE: process.env.NOTION_FIRE_DB_ID!,
  BLOG_IMMIGRATION: process.env.NOTION_IMMIGRATION_DB_ID!,
};

// Types for Notion properties (simplified)
export type NotionPage = {
  id: string;
  properties: Record<string, any>;
  url: string;
};

export type PageContent = {
  text: string;
  imageUrls: string[];
};

/**
 * Helper to get text and images from a page
 */
export async function getPageContent(pageId: string): Promise<PageContent> {
  const blocks = await notion.blocks.children.list({
    block_id: pageId,
  });

  let textContent = '';
  const imageUrls: string[] = [];

  for (const block of blocks.results as any[]) {
    // Handle Paragraphs
    if (block.type === 'paragraph' && block.paragraph.rich_text.length > 0) {
      textContent += block.paragraph.rich_text.map((t: any) => t.plain_text).join('') + '\n';
    }
    // Handle Headings
    else if (block.type.startsWith('heading')) {
      const richText = block[block.type].rich_text;
      if (richText.length > 0) {
        textContent += richText.map((t: any) => t.plain_text).join('') + '\n';
      }
    }
    // Handle Images
    else if (block.type === 'image') {
      const url = block.image.type === 'external' ? block.image.external.url : block.image.file.url;
      if (url) {
        imageUrls.push(url);
      }
    }
  }

  return { text: textContent.trim(), imageUrls };
}
