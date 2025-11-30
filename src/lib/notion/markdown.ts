import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';
import { marked, Token, Tokens } from 'marked';

// NOTE:
// 新版 @notionhq/client 已不再从内部路径导出 RichTextItemRequest。
// 为避免依赖不稳定的内部类型，这里使用一个最小别名来约束结构，
// 仅包含本文件真正使用到的字段。
type RichTextItemRequest = {
  type: 'text';
  text: {
    content: string;
    link?: { url: string } | null;
  };
  annotations?: {
    bold?: boolean;
    italic?: boolean;
    code?: boolean;
    [key: string]: any;
  };
  [key: string]: any;
};

// Configure marked to use GFM (tables, etc.)
marked.use({ gfm: true });

// --- Helper: Convert Inline Tokens to Notion RichText ---
function tokensToRichText(tokens: Token[]): RichTextItemRequest[] {
  const richText: RichTextItemRequest[] = [];

  for (const token of tokens) {
    if (token.type === 'text' || token.type === 'escape') {
      const content = (token as any).text;
      if (content) {
          if ((token as any).tokens) {
              richText.push(...tokensToRichText((token as any).tokens));
          } else {
              richText.push({ type: 'text', text: { content } });
          }
      }
    } else if (token.type === 'strong') { // Bold
      const inner = tokensToRichText((token as any).tokens || []);
      inner.forEach(item => {
        if (item.type === 'text') {
            item.annotations = { ...item.annotations, bold: true };
        }
      });
      richText.push(...inner);
    } else if (token.type === 'em') { // Italic
      const inner = tokensToRichText((token as any).tokens || []);
      inner.forEach(item => {
        if (item.type === 'text') {
            item.annotations = { ...item.annotations, italic: true };
        }
      });
      richText.push(...inner);
    } else if (token.type === 'codespan') { // Inline Code
      richText.push({
        type: 'text',
        text: { content: (token as any).text },
        annotations: { code: true },
      });
    } else if (token.type === 'link') { // Link
      const inner = tokensToRichText((token as any).tokens || []);
      const url = (token as any).href;
      inner.forEach(item => {
        if (item.type === 'text') {
            item.text.link = { url };
        }
      });
      richText.push(...inner);
    } else if (token.type === 'image') { 
       // Inline image in text - treat as text caption for now or ignore
       // Notion doesn't support inline images in paragraphs
       richText.push({ type: 'text', text: { content: `[Image: ${(token as any).text}]` } });
    } else if (token.type === 'br') {
        richText.push({ type: 'text', text: { content: '\n' } });
    } else {
       const raw = (token as any).raw || (token as any).text || '';
       richText.push({ type: 'text', text: { content: raw } });
    }
  }

  // Merge adjacent plain text nodes
  const merged: RichTextItemRequest[] = [];
  let current: RichTextItemRequest | null = null;

  for (const item of richText) {
      if (!current) {
          current = item;
          continue;
      }
      const sameAnnotations = JSON.stringify(current.annotations) === JSON.stringify(item.annotations);
      const sameLink = JSON.stringify(current.text?.link) === JSON.stringify(item.text?.link);
      
      if (current.type === 'text' && item.type === 'text' && sameAnnotations && sameLink) {
          current.text.content += item.text.content;
      } else {
          merged.push(current);
          current = item;
      }
  }
  if (current) merged.push(current);

  return merged.length > 0 ? merged : [{ type: 'text', text: { content: '' } }];
}

// --- Main Parser: Markdown to Blocks ---
export function markdownToBlocks(markdown: string): BlockObjectRequest[] {
  // Debug Log
  if (process.env.NODE_ENV === 'development') {
    console.log('[MarkdownParser AST] Parsing content length:', markdown.length);
  }

  const blocks: BlockObjectRequest[] = [];
  const tokens = marked.lexer(markdown);

  for (const token of tokens) {
    if (token.type === 'heading') {
      const depth = token.depth;
      const richText = tokensToRichText(token.tokens || []);
      
      if (depth === 1) {
        blocks.push({ object: 'block', type: 'heading_1', heading_1: { rich_text: richText } });
      } else if (depth === 2) {
        blocks.push({ object: 'block', type: 'heading_2', heading_2: { rich_text: richText } });
      } else {
        blocks.push({ object: 'block', type: 'heading_3', heading_3: { rich_text: richText } });
      }
    } 
    else if (token.type === 'paragraph') {
      // Check for standalone image wrapped in paragraph
      if (token.tokens && token.tokens.length === 1 && token.tokens[0].type === 'image') {
          const imgToken = token.tokens[0] as Tokens.Image;
          blocks.push({
            object: 'block',
            type: 'image',
            image: {
                type: 'external',
                external: { url: imgToken.href },
                caption: imgToken.text ? [{ type: 'text', text: { content: imgToken.text } }] : [],
            }
          });
      } else {
        blocks.push({
            object: 'block',
            type: 'paragraph',
            paragraph: { rich_text: tokensToRichText(token.tokens || []) }
        });
      }
    }
    else if (token.type === 'list') {
      const isOrdered = token.ordered;
      for (const item of token.items) {
          let itemRichText: RichTextItemRequest[] = [];
          item.tokens.forEach((t: any) => {
              if (t.type === 'text') {
                  itemRichText.push(...tokensToRichText((t as any).tokens || [{type:'text', text: t.text}]));
              } else if (t.type === 'paragraph') {
                   itemRichText.push(...tokensToRichText(t.tokens || []));
              }
          });

          if (isOrdered) {
              blocks.push({
                  object: 'block',
                  type: 'numbered_list_item',
                  numbered_list_item: { rich_text: itemRichText }
              });
          } else {
               blocks.push({
                  object: 'block',
                  type: 'bulleted_list_item',
                  bulleted_list_item: { rich_text: itemRichText }
              });
          }
      }
    }
    else if (token.type === 'blockquote') {
       const quoteText: RichTextItemRequest[] = [];
       token.tokens?.forEach(t => {
           if (t.type === 'paragraph') quoteText.push(...tokensToRichText(t.tokens || []));
           quoteText.push({ type: 'text', text: { content: '\n' } });
       });
       if (quoteText.length > 0 && quoteText[quoteText.length-1].text?.content === '\n') {
           quoteText.pop();
       }
       blocks.push({
           object: 'block',
           type: 'quote',
           quote: { rich_text: quoteText }
       });
    }
    else if (token.type === 'code') {
        blocks.push({
            object: 'block',
            type: 'code',
            code: {
                language: token.lang || 'plain text',
                rich_text: [{ type: 'text', text: { content: token.text } }]
            }
        });
    }
    else if (token.type === 'image') {
        blocks.push({
            object: 'block',
            type: 'image',
            image: {
                type: 'external',
                external: { url: token.href },
                caption: token.text ? [{ type: 'text', text: { content: token.text } }] : [],
            }
        });
    }
    else if (token.type === 'table') {
        const tableRows: any[] = [];
        const headerCells = token.header.map((cell: any) => tokensToRichText(cell.tokens));
        tableRows.push({
            object: 'block',
            type: 'table_row',
            table_row: { cells: headerCells }
        });
        for (const row of token.rows) {
            const rowCells = row.map((cell: any) => tokensToRichText(cell.tokens));
             tableRows.push({
                object: 'block',
                type: 'table_row',
                table_row: { cells: rowCells }
            });
        }
        blocks.push({
            object: 'block',
            type: 'table',
            table: {
                table_width: token.header.length,
                has_column_header: true,
                has_row_header: false,
                children: tableRows
            }
        });
    }
    else if (token.type === 'hr') {
        blocks.push({
            object: 'block',
            type: 'divider',
            divider: {}
        });
    }
  }

  return blocks;
}
