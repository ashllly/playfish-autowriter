import { BlockObjectRequest, RichTextItemRequest } from '@notionhq/client/build/src/api-endpoints';

// --- Inline Parser (Bold, Italic, Link, Code) ---
function parseRichText(text: string): RichTextItemRequest[] {
  const tokens: RichTextItemRequest[] = [];
  // Regex: **bold**, *italic*, `code`, [link](url)
  const regex = /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;
  
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({
        type: 'text',
        text: { content: text.slice(lastIndex, match.index) },
      });
    }

    const fullMatch = match[0];
    
    if (fullMatch.startsWith('**')) {
      tokens.push({
        type: 'text',
        text: { content: fullMatch.slice(2, -2) },
        annotations: { bold: true },
      });
    } else if (fullMatch.startsWith('*')) {
      tokens.push({
        type: 'text',
        text: { content: fullMatch.slice(1, -1) },
        annotations: { italic: true },
      });
    } else if (fullMatch.startsWith('`')) {
      tokens.push({
        type: 'text',
        text: { content: fullMatch.slice(1, -1) },
        annotations: { code: true },
      });
    } else if (fullMatch.startsWith('[')) {
      const linkText = fullMatch.match(/\[(.*?)\]/)?.[1] || '';
      const linkUrl = fullMatch.match(/\((.*?)\)/)?.[1] || '';
      tokens.push({
        type: 'text',
        text: { content: linkText, link: { url: linkUrl } },
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({
      type: 'text',
      text: { content: text.slice(lastIndex) },
    });
  }

  return tokens.length > 0 ? tokens : [{ type: 'text', text: { content: text } }];
}

// --- Block Parser (Robust V2) ---
export function markdownToBlocks(markdown: string): BlockObjectRequest[] {
  // Debug Log for Development
  if (process.env.NODE_ENV === 'development') {
    // console.log('[MarkdownParser] Input Preview:', markdown.substring(0, 100).replace(/\n/g, '\\n'));
  }

  const blocks: BlockObjectRequest[] = [];
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    // 1. Image Check (Priority High)
    // Relaxed Regex: ^!\[(.*?)\]\((.*?)\)
    // Allows trailing spaces.
    const imgMatch = trimmed.match(/^!\[(.*?)\]\((.*?)\)/);
    if (imgMatch) {
      blocks.push({
        object: 'block',
        type: 'image',
        image: {
          type: 'external',
          external: { url: imgMatch[2].trim() },
          caption: imgMatch[1] ? [{ type: 'text', text: { content: imgMatch[1] } }] : [],
        }
      });
      continue;
    }

    // 2. Heading Check (Unified & Robust)
    // Matches: # Title, ##Title, ###  Title  ###
    // Captures: 1=hashes, 2=content
    const headingMatch = trimmed.match(/^(#{1,3})\s*(.*?)(?:\s*#+)?$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      let content = headingMatch[2].trim();
      
      // Cleanup: Remove bold/italic wrapping if GPT did `## **Title**`
      // Notion headings are styled by default, redundant formatting can look messy
      content = content.replace(/^\*\*(.*)\*\*$/, '$1').replace(/^\*(.*)\*$/, '$1');

      if (level === 1) {
        blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: parseRichText(content) } });
      } else if (level === 2) {
        blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: parseRichText(content) } });
      } else if (level === 3) {
        blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: parseRichText(content) } });
      }
      continue;
    }

    // 3. Lists & Quote
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    const quoteMatch = trimmed.match(/^>\s+(.+)$/);

    if (ulMatch) {
      blocks.push({
        object: 'block',
        type: 'bulleted_list_item',
        bulleted_list_item: { rich_text: parseRichText(ulMatch[1]) },
      });
    }
    else if (olMatch) {
      blocks.push({
        object: 'block',
        type: 'numbered_list_item',
        numbered_list_item: { rich_text: parseRichText(olMatch[2]) },
      });
    }
    else if (quoteMatch) {
      blocks.push({
        object: 'block',
        type: 'quote',
        quote: { rich_text: parseRichText(quoteMatch[1]) },
      });
    }
    else {
      // Standard Paragraph
      blocks.push({
        object: 'block',
        type: 'paragraph',
        paragraph: { rich_text: parseRichText(trimmed) },
      });
    }
  }

  return blocks;
}
