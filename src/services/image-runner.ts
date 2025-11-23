import { openai, MODELS } from '@/lib/openai/client';
import { notion } from '@/lib/notion/client';
import { uploadImage } from '@/lib/storage/client';
import { nanoid } from 'nanoid';

// Presets based on User's Style Guide V1
const THEME_PRESETS: Record<string, string> = {
  Immigrant: "European or global city landmarks, airport scenes, passports or luggage, clean and minimal composition, cool tones, sky blue and beige colors.",
  FIRE: "Clean desk with notebook, calculator, laptop, dollar bills, savings concept, soft natural light, modern and simple composition, cool tones.",
  Playfish: "Modern workspace, coffee shop vibe, laptop, notebook, or lifestyle scenes, clean composition, neutral tones, professional yet relaxed."
};

const BASE_STYLE = "Style: Realistic photography, clean, bright, professional, trustworthy. Color style: cool tones and neutral tones (light blue, beige, white, wood). Composition: Simple, plenty of empty space, minimal objects. Vibe: Modern lifestyle.";

export async function generateAndUploadCover(
  pageId: string,
  title: string,
  blogTheme: string,
  keywords: string
) {
  console.log(`🎨 Generating cover for: ${title} (${blogTheme})`);

  try {
    // 1. Construct Prompt
    const themePreset = THEME_PRESETS[blogTheme] || THEME_PRESETS['Playfish'];
    // Use first 2 keywords or title if no keywords
    const subject = keywords.split(',').slice(0, 2).join(' ') || title;
    
    const prompt = `A clean, bright, realistic photograph representing: ${subject}. 
    Elements: ${themePreset}
    ${BASE_STYLE}
    Image ratio 1792x1024 (landscape), realistic photography, no text, no illustration.`;

    console.log(`Prompt: ${prompt}`);

    // 2. Call DALL-E 3
    // Note: DALL-E 3 only supports 1024x1024, 1024x1792, 1792x1024
    const response = await openai.images.generate({
      model: "dall-e-3",
      prompt: prompt,
      size: "1792x1024",
      quality: "standard",
      n: 1,
    });

    const imageUrl = response.data[0]?.url;
    if (!imageUrl) throw new Error("No image URL returned from OpenAI");

    console.log("Image generated, downloading...");

    // 3. Download Image
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) throw new Error(`Failed to download image: ${imageRes.statusText}`);
    const imageBuffer = Buffer.from(await imageRes.arrayBuffer());

    // 4. Upload to R2
    const fileKey = `covers/${blogTheme.toLowerCase()}/${nanoid(10)}.png`;
    console.log(`Uploading to R2: ${fileKey}`);
    const publicUrl = await uploadImage(imageBuffer, fileKey, 'image/png');

    console.log(`Uploaded: ${publicUrl}`);

    // 5. Update Notion
    console.log(`Updating Notion Page ${pageId} with Cover URL...`);
    
    // Debug: Check if page exists and log properties
    /*
    try {
      const page = await notion.pages.retrieve({ page_id: pageId });
      console.log('Current Page Properties Keys:', Object.keys((page as any).properties));
    } catch (e) {
      console.warn('Could not retrieve page info for debug', e);
    }
    */

    const updateResponse = await notion.pages.update({
      page_id: pageId,
      properties: {
        Cover: {
          url: publicUrl
        }
      }
    });
    
    console.log(`Notion Update Response: ID=${updateResponse.id}`);

    return { success: true, url: publicUrl };

  } catch (error: any) {
    console.error("Image Generation Failed:", error);
    
    // Provide more helpful error messages
    let errorMessage = error.message;
    if (error.message?.includes('R2 Bucket configuration missing') || 
        error.message?.includes('Cloudflare R2 credentials missing')) {
      errorMessage = `Cloudflare R2 配置缺失。请在 .env.local 中添加以下环境变量：
- CLOUDFLARE_ACCOUNT_ID
- CLOUDFLARE_ACCESS_KEY_ID
- CLOUDFLARE_SECRET_ACCESS_KEY
- CLOUDFLARE_R2_BUCKET_NAME
- CLOUDFLARE_R2_PUBLIC_URL

图片已生成，但无法上传到 R2。请配置 R2 后重试。`;
    }
    
    return { success: false, error: errorMessage };
  }
}

