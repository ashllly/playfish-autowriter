import { notion, DB_IDS, getPageContent } from '@/lib/notion/client';
import { openai, MODELS, ChatMessage } from '@/lib/openai/client';
import { nanoid } from 'nanoid';

export async function runSourceRunner() {
  console.log('Starting Source Runner...');

  // 1. Query Source DB - NO FILTER initially to debug schema
  // Just get the last 10 edited pages
  const response = await notion.databases.query({
    database_id: DB_IDS.SOURCE,
    page_size: 10,
    sorts: [
      {
        timestamp: 'last_edited_time',
        direction: 'descending',
      },
    ],
  });

  const pages = response.results;
  console.log(`Fetched ${pages.length} pages from Source DB.`);

  if (pages.length === 0) {
    return { processed: 0, message: 'Database is empty' };
  }

  // Debug: Log the property names and types of the first page
  if (pages.length > 0) {
    const firstPage = pages[0] as any;
    const propKeys = Object.keys(firstPage.properties);
    console.log('--- DB Schema Debug ---');
    propKeys.forEach(key => {
      const prop = firstPage.properties[key];
      console.log(`Property: "${key}" | Type: ${prop.type}`);
    });
    console.log('-----------------------');
  }

  let processedCount = 0;

  for (const page of pages) {
    const p = page as any;
    
    // 2. Identify key properties dynamically
    // Find the 'title' property
    const titlePropKey = Object.keys(p.properties).find(
      key => p.properties[key].type === 'title'
    );
    
    // Find the 'SourceID' property (assuming it contains "SourceID" or is rich_text and we want to use it)
    // Or we can stick to hardcoded 'SourceID' if we confirm it exists.
    // Let's try to find a property named exactly 'SourceID' or closely matching
    const sourceIdPropKey = Object.keys(p.properties).find(
      key => key.toLowerCase() === 'sourceid' || key === 'SourceID'
    );

    if (!titlePropKey) {
      console.warn(`Page ${p.id} missing 'title' property. Skipping.`);
      continue;
    }

    // Check values
    const titleValue = p.properties[titlePropKey].title;
    const sourceIdValue = sourceIdPropKey ? p.properties[sourceIdPropKey].rich_text : [];

    const hasTitle = titleValue && titleValue.length > 0 && titleValue[0].plain_text.trim().length > 0;
    const hasSourceId = sourceIdValue && sourceIdValue.length > 0 && sourceIdValue[0].plain_text.trim().length > 0;

    // Condition: If BOTH exist, skip. If ANY is missing, process.
    if (hasTitle && hasSourceId) {
      console.log(`Page ${p.id} already has Title and SourceID. Skipping.`);
      continue;
    }

    console.log(`Processing Page ${p.id}... (Missing Title: ${!hasTitle}, Missing SourceID: ${!hasSourceId})`);

    try {
      const pageId = page.id;
      const content = await getPageContent(pageId);

      // 3. Generate Data
      let newTitle = '';
      const newSourceId = `src_${nanoid(8)}`;

      // Generate Title if missing
      if (!hasTitle) {
        // If we have images, prioritize Vision
        if (content.imageUrls.length > 0) {
          console.log(`Page ${pageId} has images. Using Vision model to generate title.`);
          const messages: any[] = [
            {
              role: 'system',
              content: `You are an editor helper. Look at the image provided (which might be a screenshot of a post, article, or note). Extract the main topic or title from it. Return ONLY the title text, no quotes. Language: Chinese (Simplified).`,
            },
            {
              role: 'user',
              content: [
                {
                  type: 'image_url',
                  image_url: {
                    url: content.imageUrls[0], // Use the first image
                  },
                },
              ],
            },
          ];

          // Using gpt-4o for vision capabilities
          const generatedTitle = await openai.chat.completions.create({
            model: 'gpt-4o', 
            messages,
            max_tokens: 100,
          });

          newTitle = generatedTitle.choices[0]?.message?.content?.trim() || 'Untitled Source (Image)';
        } 
        // Fallback to text content
        else if (!content.text.trim()) {
          console.log(`Page ${pageId} has no content. Setting default title.`);
          newTitle = 'Untitled Source (No Content)';
        } else {
          const messages: ChatMessage[] = [
            {
              role: 'system',
              content: `You are an editor helper. Read the following raw content (which might be OCR text from a screenshot or pasted notes) and generate a concise, engaging title for it. The title should capture the main idea. Return ONLY the title text, no quotes. Language: Chinese (Simplified).`,
            },
            {
              role: 'user',
              content: content.text.substring(0, 2000),
            },
          ];

          const generatedTitle = await openai.chat.completions.create({
            model: MODELS.CLASSIFY, 
            messages,
          });

          newTitle = generatedTitle.choices[0]?.message?.content?.trim() || 'Untitled Source';
        }
      }

      // 4. Update Notion Page
      const propertiesToUpdate: any = {};

      if (!hasTitle) {
        propertiesToUpdate[titlePropKey] = {
          title: [
            {
              text: {
                content: newTitle,
              },
            },
          ],
        };
      }

      // Always update SourceID if it's missing
      if (!hasSourceId && sourceIdPropKey) {
        propertiesToUpdate[sourceIdPropKey] = {
          rich_text: [
            {
              text: {
                content: newSourceId,
              },
            },
          ],
        };
      } else if (!sourceIdPropKey) {
        console.error(`Cannot find 'SourceID' property in schema. Available: ${Object.keys(p.properties).join(', ')}`);
      }

      if (Object.keys(propertiesToUpdate).length > 0) {
        await notion.pages.update({
          page_id: pageId,
          properties: propertiesToUpdate,
        });
        console.log(`Updated Page ${pageId}: ${JSON.stringify(propertiesToUpdate)}`);
        processedCount++;
      }

    } catch (error) {
      console.error(`Failed to process page ${page.id}:`, error);
    }
  }

  return { processed: processedCount };
}
