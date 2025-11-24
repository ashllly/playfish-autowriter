# 🏷️ Playfish Tag System (标签映射系统)

本文档定义了 Playfish AutoWriter 系统中所有预定义标签的 Slug 与三语言名称映射关系。
此文档应与代码库中的 `src/lib/constants/tags.ts` 保持一致。

## 核心原则 (Core Principles)
1.  **Slug 是唯一标识符 (SSOT)**：所有翻译和映射均基于 `tag-slug`。
2.  **强制映射**：只要 Slug 在下表中存在，系统将强制使用定义的翻译，忽略 GPT 的建议。
3.  **三语言对齐**：每个 Slug 必须对应 Simplified Chinese (zh-hans), English (en), Traditional Chinese (zh-hant)。

---

## 1. Blog-Playfish (摸鱼主题)

| Tag Slug (ID) | 🇨🇳 zh-hans (简体) | 🇺🇸 en (English) | 🇹🇼 zh-hant (繁體) |
| :--- | :--- | :--- | :--- |
| `art-of-fish` | 摸鱼艺术 | Art of Slacking | 摸魚藝術 |
| `time-management` | 时间管理 | Time Management | 時間管理 |

---

## 2. Blog-Immigrant (移民主题)

| Tag Slug (ID) | 🇨🇳 zh-hans (简体) | 🇺🇸 en (English) | 🇹🇼 zh-hant (繁體) |
| :--- | :--- | :--- | :--- |
| `asia` | 亚洲 | Asia | 亞洲 |
| `eu` | 欧洲 | Europe | 歐洲 |
| `na` | 北美 | North America | 北美 |
| `au` | 澳洲 | Australia | 澳洲 |

---

## 3. Blog-FIRE (FIRE主题)

| Tag Slug (ID) | 🇨🇳 zh-hans (简体) | 🇺🇸 en (English) | 🇹🇼 zh-hant (繁體) |
| :--- | :--- | :--- | :--- |
| `what-is-fire` | 什么是FIRE | What is FIRE | 什麼是FIRE |
| `living-cost` | 生活成本 | Cost of Living | 生活成本 |
| `financial-planning` | 理财规划 | Financial Planning | 理財規劃 |
| `health-insurance` | 医疗保险 | Health Insurance | 醫療保險 |
| `middle-class-anxiety` | 中产焦虑 | Middle Class Anxiety | 中產焦慮 |
| `risk-management` | 风险管理 | Risk Management | 風險管理 |

---

## 🔄 自动化逻辑说明

当 Translation Runner 翻译文章时：
1.  读取源文章的 `tag-slug` 列表。
2.  **查表**：检查 Slug 是否存在于上表。
    *   ✅ **命中**：直接使用表中对应的目标语言 Tag Name。
    *   ❌ **未命中**：将 Slug 发送给 GPT，要求其根据 Slug 字面意义生成目标语言 Tag Name。
3.  **输出**：生成的 Tag 列表数量将严格等于 Slug 列表数量。

