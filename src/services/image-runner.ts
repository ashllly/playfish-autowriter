import { openai, MODELS } from '@/lib/openai/client';
import { notion } from '@/lib/notion/client';
import { uploadImage } from '@/lib/storage/client';
import { nanoid } from 'nanoid';
import { PROMPTS } from '@/lib/openai/prompts';

// Presets based on User's Style Guide V1 (still used as tonal reference)
const THEME_PRESETS: Record<string, string> = {
  Immigrant: 'Global city streets, visa offices, relocation essentials, natural light, cool palette.',
  FIRE: 'Financial planning desks, spreadsheets, calculators, confident adults, muted tones.',
  Playfish: 'Modern work/life scenes, candid portraits, cozy cafés, neutral palettes, warm highlights.',
};

const BASE_STYLE =
  [
    // 相机与镜头（强化“真实相机”感）
    'Shot on Sony A7R IV, 50mm f/1.8 portrait lens, shallow depth of field, natural bokeh.',
    // 皮肤与质感
    'Natural skin texture with visible pores and tiny imperfections, subtle facial hair where appropriate, realistic lighting on skin, no beauty filter.',
    // 环境与光线
    'Golden hour sunlight or soft natural window light, gentle soft shadows, believable street ambient light where relevant.',
    // 纹理与噪点
    'Subtle film grain, very light motion blur if subject is moving, realistic color grading similar to professional photography.',
    // 明确排除插画风格
    'Ultra realistic photography, NOT illustration, NOT 3D render, NOT CGI, NOT vector art.',
    // 避免 AI 过度美化
    'Avoid prompts like perfect face, flawless skin, hyper-beautiful; faces should look like real people, not AI models.',
    // 构图规格
    'Aspect ratio 1792x1024 landscape, enough negative space for layout, clean and modern composition.',
  ].join(' ');

const COVER_ALT_THEME_LABELS: Record<string, string> = {
  Playfish: '职场与生活方式',
  FIRE: '投资与资产配置',
  Immigrant: '海外生活与移民',
};

type CoverAltPlan = {
  coverAlt: string;
  imagePrompt: string;
  shotType?: 'close-up' | 'medium' | 'wide';
};

function buildFallbackCoverAlt(title: string, theme: string, keywords: string) {
  const themeLabel = COVER_ALT_THEME_LABELS[theme] || theme;
  const keywordList = (keywords || '')
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean);
  const keywordPart = keywordList.slice(0, 3).join('、');
  if (keywordPart) {
    return `${title}｜${themeLabel}｜${keywordPart}封面图`;
  }
  return `${title}｜${themeLabel}主题封面图`;
}

export async function generateCoverAltPlan(params: {
  title: string;
  blogTheme: string;
  summary: string;
  keywords?: string;
}): Promise<CoverAltPlan> {
  const { title, blogTheme, summary, keywords = '' } = params;
  const fallbackAlt = buildFallbackCoverAlt(title, blogTheme, keywords);
  const safeSummary = summary?.trim().slice(0, 1200);

  if (!safeSummary) {
    return {
      coverAlt: fallbackAlt,
      imagePrompt: `${fallbackAlt}. Real people, real location, natural light.`,
      shotType: 'medium',
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: MODELS.SEO,
      messages: [
        { role: 'system', content: PROMPTS.PF_COVER_ALT },
        {
          role: 'user',
          content: JSON.stringify(
            {
              Title: title,
              Theme: blogTheme,
              Summary: safeSummary,
              Keywords: keywords,
            },
            null,
            2
          ),
        },
      ],
      response_format: { type: 'json_object' },
    });

    const payloadStr = completion.choices[0]?.message?.content;
    if (!payloadStr) {
      throw new Error('Empty response from PF_COVER_ALT');
    }
    const payload = JSON.parse(payloadStr);
    return {
      coverAlt: (payload.coverAlt || fallbackAlt).slice(0, 200),
      imagePrompt:
        payload.imagePrompt ||
        `${fallbackAlt} realistic scene, real humans, soft cinematic light`,
      shotType: payload.shotType || 'medium',
    };
  } catch (error) {
    console.warn('Cover Alt generation failed, using fallback:', error);
    return {
      coverAlt: fallbackAlt,
      imagePrompt: `${fallbackAlt}. Real people or real objects, cinematic light.`,
      shotType: 'medium',
    };
  }
}

type GenerateCoverOptions = {
  pageId: string;
  title: string;
  blogTheme: string;
  coverAlt: string;
  visualPrompt?: string;
  keywords?: string;
  hasCoverAltProperty?: boolean;
  shotType?: 'close-up' | 'medium' | 'wide';
};

export async function generateAndUploadCover(options: GenerateCoverOptions) {
  const {
    pageId,
    title,
    blogTheme,
    coverAlt,
    visualPrompt,
    keywords = '',
    hasCoverAltProperty = true,
    shotType = 'medium',
  } = options;

  console.log(`🎨 Generating cover for: ${title} (${blogTheme})`);

  try {
    // 1. Construct Prompt
    const themePreset = THEME_PRESETS[blogTheme] || THEME_PRESETS['Playfish'];
    const realismGuard =
      'Focus on authentic people or real objects, candid emotion, documentary-style realism. Avoid cliché motifs like generic passport-and-ticket unless explicitly in the alt text. Faces and objects must look like real-world photography, not illustration or CGI.';
    const subject =
      visualPrompt ||
      coverAlt ||
      `${title} realistic scene with ${keywords.split(',').slice(0, 2).join(' ')}`;

    const prompt = `${subject}.
    ${realismGuard}
    ${themePreset}
    ${BASE_STYLE}
    Shot guidance: ${shotType} shot, landscape 1792x1024, eye-level perspective.
    `;

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

    const imageUrl = response.data?.[0]?.url;
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

    const propertiesUpdate: Record<string, any> = {
      Cover: { url: publicUrl },
    };

    // 全局约定：博客 DB 中 Alt 字段命名为 "Cover Alt"
    if (hasCoverAltProperty && coverAlt) {
      propertiesUpdate['Cover Alt'] = {
        rich_text: [{ text: { content: coverAlt.slice(0, 200) } }],
      };
    }

    const updateResponse = await notion.pages.update({
      page_id: pageId,
      properties: propertiesUpdate,
    });
    
    console.log(`Notion Update Response: ID=${updateResponse.id}`);

    return { success: true, url: publicUrl };

  } catch (error: any) {
    console.error('Image Generation Failed:', error);
    
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

