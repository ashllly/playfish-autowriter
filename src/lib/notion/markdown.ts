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

// --- Block Parser (Regex Enhanced) ---
export function markdownToBlocks(markdown: string): BlockObjectRequest[] {
  const blocks: BlockObjectRequest[] = [];
  // Split by newline, handle \r\n and \n
  const lines = markdown.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines? Notion blocks have default spacing.
    if (!trimmed) continue;

    // Regular Expressions for stricter but indent-friendly matching
    // Note: order matters (H3 before H1/H2 if logic was fuzzy, but regex makes it specific)
    const h3Match = trimmed.match(/^###\s+(.+)$/);
    const h2Match = trimmed.match(/^##\s+(.+)$/);
    const h1Match = trimmed.match(/^#\s+(.+)$/);
    const ulMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const olMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    const quoteMatch = trimmed.match(/^>\s+(.+)$/);

    if (h3Match) {
      blocks.push({
        object: 'block',
        type: 'heading_3',
        heading_3: { rich_text: parseRichText(h3Match[1]) },
      });
    }
    else if (h2Match) {
      blocks.push({
        object: 'block',
        type: 'heading_2',
        heading_2: { rich_text: parseRichText(h2Match[1]) },
      });
    }
    else if (h1Match) {
      blocks.push({
        object: 'block',
        type: 'heading_1',
        heading_1: { rich_text: parseRichText(h1Match[1]) },
      });
    }
    else if (ulMatch) {
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
