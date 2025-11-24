export type TagDefinition = {
  slug: string;
  'zh-hans': string;
  'en': string;
  'zh-hant': string;
};

export const TAG_DEFINITIONS: Record<string, TagDefinition[]> = {
  Playfish: [
    { slug: 'art-of-fish', 'zh-hans': '摸鱼艺术', en: 'Art of Slacking', 'zh-hant': '摸魚藝術' },
    { slug: 'time-management', 'zh-hans': '时间管理', en: 'Time Management', 'zh-hant': '時間管理' },
  ],
  Immigrant: [
    { slug: 'asia', 'zh-hans': '亚洲', en: 'Asia', 'zh-hant': '亞洲' },
    { slug: 'eu', 'zh-hans': '欧洲', en: 'Europe', 'zh-hant': '歐洲' },
    { slug: 'na', 'zh-hans': '北美', en: 'North America', 'zh-hant': '北美' },
    { slug: 'au', 'zh-hans': '澳洲', en: 'Australia', 'zh-hant': '澳洲' },
  ],
  FIRE: [
    { slug: 'what-is-fire', 'zh-hans': '什么是FIRE', en: 'What is FIRE', 'zh-hant': '什麼是FIRE' },
    { slug: 'living-cost', 'zh-hans': '生活成本', en: 'Cost of Living', 'zh-hant': '生活成本' },
    { slug: 'financial-planning', 'zh-hans': '理财规划', en: 'Financial Planning', 'zh-hant': '理財規劃' },
    { slug: 'health-insurance', 'zh-hans': '医疗保险', en: 'Health Insurance', 'zh-hant': '醫療保險' },
    { slug: 'middle-class-anxiety', 'zh-hans': '中产焦虑', en: 'Middle Class Anxiety', 'zh-hant': '中產焦慮' },
    { slug: 'risk-management', 'zh-hans': '风险管理', en: 'Risk Management', 'zh-hant': '風險管理' },
  ]
};

// Helper to get tag name by slug and lang
export function getTagName(theme: string, slug: string, lang: 'zh-hans' | 'en' | 'zh-hant'): string | null {
  const tags = TAG_DEFINITIONS[theme];
  if (!tags) return null;
  const tag = tags.find(t => t.slug === slug);
  return tag ? tag[lang] : null;
}

