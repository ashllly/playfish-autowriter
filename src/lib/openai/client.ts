import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY is not defined');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
  project: process.env.OPENAI_PROJECT_ID,
});

// Model constants
export const MODELS = {
  REWRITE: 'gpt-4-turbo', // Placeholder for GPT-5.1, using current best
  TRANSLATE: 'gpt-4o-mini',
  SEO: 'gpt-4o-mini',
  CLASSIFY: 'gpt-4o-mini',
  IMAGE: 'dall-e-3', // Placeholder for GPT-image-1
};

export type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

/**
 * Simple wrapper for chat completions
 */
export async function completion(
  messages: ChatMessage[],
  model: string = MODELS.REWRITE,
  temperature: number = 0.7
): Promise<string | null> {
  try {
    const response = await openai.chat.completions.create({
      model,
      messages,
      temperature,
    });
    return response.choices[0]?.message?.content || null;
  } catch (error) {
    console.error('OpenAI Completion Error:', error);
    throw error;
  }
}

