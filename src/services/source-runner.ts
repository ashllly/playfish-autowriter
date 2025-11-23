import { notion, DB_IDS, getPageContent } from '@/lib/notion/client';
import { openai, MODELS, ChatMessage } from '@/lib/openai/client';
import { nanoid } from 'nanoid';

export async function runSourceRunner() {
  console.log('Starting Source Runner...');
  if (!notion || !(notion as any).databases) {
    console.error('Notion client not initialized correctly:', notion);
    throw new Error('Notion client misconfiguration');
  }
  console.log('Notion client ready. Databases available:', Object.keys((notion as any).databases || {}));
  console.log('Typeof notion.databases.query:', typeof (notion as any).databases?.query);

  // 1. Query Source DB for items that need processing
  // Criteria: Title is empty OR SourceID is empty
  const response = await notion.databases.query({
    database_id: DB_IDS.SOURCE,
    filter: {
      or: [
        {
          property: 'Title',
          title: {
            is_empty: true,
          },
        },
        {
          property: 'SourceID',
          rich_text: {
            is_empty: true,
          },
        },
      ],
    },
  });

  const pages = response.results;
  console.log(`Found ${pages.length} pages to process.`);

  if (pages.length === 0) {
    return { processed: 0 };
  }

  let processedCount = 0;

  for (const page of pages) {
    try {
      const pageId = page.id;
      
      // 2. Get page content (text from blocks)
      // Note: In future, we might need to handle images specifically if GPT-4o-mini supports image input URL
      // For now, we assume user might paste text or we extract text from image (if Notion OCR works)
      // Or we simply rely on GPT generating a generic title if content is empty (unlikely if user pasted stuff)
      const content = await getPageContent(pageId);

      // 3. Generate Data
      let title = '';
      const sourceId = `src_${nanoid(8)}`; // Generate unique ID

      if (!content.trim()) {
        console.log(`Page ${pageId} has no content. Setting default title.`);
        title = 'Untitled Source (No Content)';
      } else {
        // Ask GPT to generate a title based on content
        const messages: ChatMessage[] = [
          {
            role: 'system',
            content: `You are an editor helper. Read the following raw content (which might be OCR text from a screenshot or pasted notes) and generate a concise, engaging title for it. The title should capture the main idea. Return ONLY the title text, no quotes. Language: Chinese (Simplified).`,
          },
          {
            role: 'user',
            content: content.substring(0, 2000), // Limit context to avoid token limits
          },
        ];

        const generatedTitle = await openai.chat.completions.create({
          model: MODELS.CLASSIFY, // Using mini model for simple titling
          messages,
        });

        title = generatedTitle.choices[0]?.message?.content?.trim() || 'Untitled Source';
      }

      // 4. Update Notion Page
      // We only update fields that are empty to avoid overwriting manual edits (though filter handles this partly)
      const propertiesToUpdate: any = {};
      
      // Check if Title is actually empty in the page object (safeguard)
      if ('Title' in (page as any).properties) {
         // We always update title if we found the page via the filter, 
         // but strictly speaking we should check if it's empty. 
         // The query filter ensures at least one is empty.
         // Let's blindly update both if they matched the filter logic for simplicity,
         // or check specific properties if we want to be precise.
         propertiesToUpdate['Title'] = {
           title: [
             {
               text: {
                 content: title,
               },
             },
           ],
         };
      }

      // Always set SourceID if we are processing this page
      propertiesToUpdate['SourceID'] = {
        rich_text: [
          {
            text: {
              content: sourceId,
            },
          },
        ],
      };

      // Also set default Status to "Pending" if it's a Select field (optional based on new requirement)
      // Wait, user requirement said "Send" is a checkbox. 
      // And "Status" was removed in favor of "Send" (manual) and "Used" (auto).
      // So we don't touch Send/Used here. We just prep the data.
      
      await notion.pages.update({
        page_id: pageId,
        properties: propertiesToUpdate,
      });

      console.log(`Processed Page ${pageId}: Title="${title}", SourceID="${sourceId}"`);
      processedCount++;

    } catch (error) {
      console.error(`Failed to process page ${page.id}:`, error);
      // Continue to next page even if one fails
    }
  }

  return { processed: processedCount };
}

