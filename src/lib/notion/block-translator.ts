import { notion } from './client';
import { openai, MODELS } from '../openai/client';
import { BlockObjectRequest } from '@notionhq/client/build/src/api-endpoints';

// --- 1. Fetch Block Tree ---
export type NotionBlock = {
  id: string;
  type: string;
  has_children: boolean;
  [key: string]: any;
  children?: NotionBlock[];
};

export async function fetchBlockTree(blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = [];
  let cursor: string | undefined = undefined;
  
  while (true) {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
    });
    
    for (const block of response.results as any[]) {
      if (block.has_children) {
        // Recursive fetch
        block.children = await fetchBlockTree(block.id);
      }
      blocks.push(block);
    }
    
    if (!response.has_more) break;
    cursor = response.next_cursor || undefined;
  }
  
  return blocks;
}

// --- 2. Extract Text ---
export function collectTextNodes(blocks: NotionBlock[]): string[] {
  const texts: string[] = [];
  
  function traverse(nodes: NotionBlock[]) {
    for (const block of nodes) {
      const type = block.type;
      const data = block[type];
      
      // 1. Rich Text content (Paragraph, Heading, List Item, Quote, Callout, Toggle)
      if (data.rich_text) {
        data.rich_text.forEach((t: any) => {
          if (t.type === 'text' && t.plain_text.trim()) texts.push(t.plain_text);
        });
      }
      
      // 2. Image Caption
      if (type === 'image' && data.caption) {
        data.caption.forEach((t: any) => {
          if (t.type === 'text' && t.plain_text.trim()) texts.push(t.plain_text);
        });
      }
      
      // 3. Table Rows (Cells)
      if (type === 'table_row' && data.cells) {
        data.cells.forEach((cell: any[]) => {
          cell.forEach((t: any) => {
             if (t.type === 'text' && t.plain_text.trim()) texts.push(t.plain_text);
          });
        });
      }

      if (block.children) {
        traverse(block.children);
      }
    }
  }
  
  traverse(blocks);
  return texts;
}

// --- 3. Translate Batch (Concurrent) ---
export async function translateTexts(texts: string[], targetLang: string): Promise<string[]> {
  if (texts.length === 0) return [];

  const BATCH_SIZE = 30; // Smaller batch for safety
  const batches: string[][] = [];
  
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }

  console.log(`Translating ${texts.length} segments in ${batches.length} batches...`);

  // Process batches concurrently (Promise.all)
  const batchPromises = batches.map(async (batch, index) => {
    const batchId = index + 1;
    const prompt = `
      You are a professional translator. 
      Target Language: ${targetLang === 'en' ? 'English' : 'Traditional Chinese (Taiwan/HK)'}.
      
      [TASK]
      Translate the provided array of text segments.
      
      [RULES]
      1. Output strictly a JSON object with a "segments" key containing the array of translations.
      2. The output array MUST have exactly ${batch.length} items.
      3. Do not merge or split segments. Maintain 1-to-1 mapping.
      4. Branding: "摸鱼" -> "slow productivity", "Playfish" -> "Playfish".
      
      [INPUT JSON]
      ${JSON.stringify(batch)}
    `;

    try {
      const completion = await openai.chat.completions.create({
        model: MODELS.TRANSLATE, // gpt-4o
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' }
      });
      
      const result = JSON.parse(completion.choices[0].message.content || '{}');
      const segments = result.segments || [];
      
      if (segments.length !== batch.length) {
        console.warn(`⚠️ Batch ${batchId} mismatch! Sent ${batch.length}, got ${segments.length}. Fallback to original for this batch.`);
        return batch; 
      }
      return segments;
      
    } catch (e) {
      console.error(`❌ Batch ${batchId} failed:`, e);
      return batch; // Fallback
    }
  });

  const results = await Promise.all(batchPromises);
  return results.flat();
}

// --- 4. Reconstruct Block Tree ---
export function reconstructBlocks(originalBlocks: NotionBlock[], translatedTexts: string[]): BlockObjectRequest[] {
  // Use a mutable cursor to track position in translatedTexts
  const cursor = { index: 0 };

  function getNextTranslation(original: string): string {
    if (!original || original.trim() === '') return original; 
    if (cursor.index < translatedTexts.length) {
      return translatedTexts[cursor.index++];
    }
    return original;
  }

  function processRichText(richText: any[]): any[] {
    return richText.map(t => {
      // Only replace Text nodes that are not empty
      if (t.type === 'text' && t.plain_text.trim()) {
        // Construct new RichText object compatible with creation API
        return {
          type: 'text',
          text: { 
            content: getNextTranslation(t.plain_text),
            link: t.text.link // Preserve link
          },
          annotations: t.annotations // Preserve bold/italic/color
        };
      }
      // Return others (equations, mentions) as is, though create API might need adaptation
      return t;
    });
  }

  function traverse(blocks: NotionBlock[]): BlockObjectRequest[] {
    const newBlocks: BlockObjectRequest[] = [];

    for (const block of blocks) {
      const type = block.type;
      // Filter out unsupported types for creation
      if (['child_page', 'child_database', 'unsupported'].includes(type)) continue;

      const newBlock: any = {
        object: 'block',
        type: type,
      };

      const data = block[type];

      // Handle Data & Text Replacement
      if (data.rich_text) {
        newBlock[type] = {
          ...data,
          rich_text: processRichText(data.rich_text)
        };
      } else if (type === 'image') {
        const imageData: any = {
          type: data.type,
          caption: processRichText(data.caption || [])
        };

        if (data.type === 'external') {
           imageData.external = { url: data.external.url };
        } else if (data.type === 'file') {
           // Notion API does not support re-uploading 'file' (expiry links). 
           // Best effort: convert to external url using the temporary url if valid, 
           // OR warn/skip. Since these are signed AWS urls, they expire.
           // Ideally, we should upload to R2, but that's complex.
           // WORKAROUND: Use the signed URL as external URL (valid for ~1 hour, enough for creation?)
           // Warning: The image will break after 1 hour on the NEW page. 
           // But Notion usually caches external images? No, 'external' blocks rely on the source.
           // Actually, 'external' blocks point to any public URL. 
           // If we use the signed AWS S3 url from the source 'file', it will expire.
           // OPTION A: Ignore images (bad).
           // OPTION B: Copy as external (will expire).
           // OPTION C: If we have a Cover Manager logic, maybe use that?
           // For now, let's try mapping 'file' -> 'external' with the current URL.
           // If the user wants permanent images, they should be hosted externally or re-uploaded.
           
           imageData.type = 'external'; // Force external
           imageData.external = { url: data.file.url };
        }

        newBlock.image = imageData;
      } else if (type === 'table') {
         newBlock.table = {
           table_width: data.table_width,
           has_column_header: data.has_column_header,
           has_row_header: data.has_row_header,
           children: [] // Children (rows) will be handled below
         };
      } else if (type === 'table_row') {
          newBlock.table_row = {
              cells: data.cells.map((cell: any[]) => processRichText(cell))
          };
      } else {
          // For blocks without rich_text (divider, etc), copy specific data if needed
          // Most blocks (like divider) have empty objects or simple props
          newBlock[type] = data;
      }

      // Handle Children
      if (block.children && block.children.length > 0) {
          // Recursively process children
          const processedChildren = traverse(block.children);
          
          if (type === 'table') {
             // For Table, children (rows) MUST be in the create request's children field
             newBlock.table.children = processedChildren;
          } else {
             // For other blocks (List, Toggle), we add children property
             // Notion API allows nesting up to 2 levels deep in one create request.
             // If too deep, we might need append logic. 
             // For now, assuming standard depth. If error 'validation_error', we might need to separate.
             newBlock[type].children = processedChildren;
          }
      }
      
      newBlocks.push(newBlock);
    }
    return newBlocks;
  }

  return traverse(originalBlocks);
}
