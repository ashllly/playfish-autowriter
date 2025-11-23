# 🐟 Playfish AutoWriter 产品文档

> 项目代号：**墨语写手（MoYu AutoWriter）**  
> 项目域名：**autowriter.playfishlab.com**  
> 部署环境：Vercel  
> 数据层：Notion（3个数据库）  
> AI 引擎：OpenAI GPT-5.1 / GPT-4.1 mini  
> 图片存储：Cloudflare R2  
> 任务触发：Cron Runner / Notion Webhook

---

## 📌 一、项目背景

你正在构建一个多语言、多主题、长期运营的内容生态（**摸鱼 / FIRE / 全球移民**）。

传统写文章流程需要：
- 灵感管理
- 大纲生成
- 草稿生成
- 中文终稿
- SEO 信息
- 多语言翻译
- 封面图制作
- 发布到 Playfish 网站

这些步骤耗时、重复性强、跨工具混乱、不易追踪。

因此需要一个专属于 Playfish 的 **端到端 AI 写作自动化系统**：

```
小红书截图 → Source DB → (自动生成 Title/ID)
                          ↓
用户触发 Draft Creation → Draft DB → 大纲/草稿/思考日志
                          ↓
用户写中文终稿 → Blog DB (按主题：摸鱼/Fire/移民)
                          ↓
用户勾选 Reviewed → 自动翻译 EN/繁体 + GPT 图封面
                          ↓
写入 Blog DB (多语言版本)
                          ↓
Playfish 网站自动更新内容
```

---

## 📌 二、项目目标

### 🎯 **目标 1：让写文章的人只做"中文创作"这一件事**

你不需要：
- 写大纲
- 写初稿
- 翻译
- 写 SEO
- 生成封面图
- 部署文章

你只需要：
> **写中文定稿 + 勾选 Reviewed ✔**

剩下全部自动完成。

### 🎯 **目标 2：实现一套清晰、可追溯、灵感 → 草稿 → 发布 的数据库体系**

三个数据库：
1. **Source DB**：灵感来源（小红书素材）
2. **Draft DB**：自动生成的大纲与草稿
3. **Blog DB**（按主题分类）：正式稿，发布源

让每篇文章能追踪其来源与草稿："从哪里来的、怎么写的、最后发布在哪里"。

### 🎯 **目标 3：实现全自动的多语言发布机制**

当中文稿件标记为 Reviewed 时：
- 自动翻译 EN / 繁体
- 自动生成 SEO ICU
- 自动生成封面图
- 自动写进对应数据库
- 自动推送到 Playfish 网站

### 🎯 **目标 4：以最低成本运行系统（每篇 ~1 元）**

采用混合模型：
- 大纲 / 初稿：GPT-5.1（高质量）
- 翻译：GPT-4.1 mini（超低成本）
- 图像生成：GPT-image-1

这是最优成本/质量比方案。

---

## 📌 三、数据库结构（Data Model）

### 🟦 1. **Playfish-Blog-Source（灵感库）**

| 字段名 | 类型 | 自动/手动 | 说明 |
|--------|------|-----------|------|
| **Title** | Title | 自动 | 从正文自动生成的小红书标题 |
| **SourceID** | Text | 自动 | 例如 `src_0001` |
| **Status-Used** | Checkbox | 自动 | 表示已用此灵感生成过 draft |
| **Created time** | Created Time | 自动 | Notion 默认字段 |
| **Last edited time** | Last Edited Time | 自动 | Notion 默认字段 |
| **正文（Page Content）** | Page Content | 手动 | 用户粘贴图片 + 文本 |

**工作流程：**
- 用户粘贴素材到正文里
- 系统自动生成 Title 和 SourceID
- 当该 Source 被用于生成 Draft 后，自动标记 Status-Used = true

---

### 🟩 2. **Playfish-Blog-Auto-Draft（大纲/草稿库）**

| 字段名 | 类型 | 自动/手动 | 说明 |
|--------|------|-----------|------|
| **Title** | Title | 自动/手动 | 大纲标题 |
| **Reviewed** | Checkbox | 手动 | 勾选后触发进入下一步（生成正式稿） |
| **SourceID** | Text | 自动 | 对应 Source DB 的 SourceID |
| **DraftID** | Text | 自动 | 例如 `draft_0001` |
| **Created time** | Created Time | 自动 | Notion 默认字段 |
| **Last edited time** | Last Edited Time | 自动 | Notion 默认字段 |
| **正文（Page Content）** | Page Content | 自动 | 包含大纲、草稿、思考日志等 |

**工作流程：**
- 用户从 Source 触发生成 Draft
- 系统自动生成 Title、SourceID、DraftID
- 系统在正文中写入：大纲、草稿、思考日志
- 用户勾选 Reviewed 后，系统开始生成正式稿

---

### 🟥 3. **Playfish-Blog（正式稿库）**

**重要：博客不是按语言区分的，而是按照三大主题分类：**
- **摸鱼** (MoYu)
- **FIRE**
- **移民** (Immigration)

**每个主题的 Blog DB 结构：**

| 字段名 | 类型 | 自动/手动 | 说明 |
|--------|------|-----------|------|
| **Title** | Title | 手动 | 中文标题（用户写） |
| **Slug** | Text | 自动 | autowriter 或 blog 生成 |
| **SourceID** | Text | 手动/自动 | 方便追溯 |
| **DraftID** | Text | 手动/自动 | 方便追溯 |
| **Language** | Select | 手动/自动 | 语言标签：简体中文 / 繁体中文 / English |
| **Content** | Page Content | 手动 | 正文内容 |
| **ICU_Title** | Text | 自动 | SEO 标题 |
| **ICU_Description** | Text | 自动 | SEO 描述 |
| **ICU_Keywords** | Text | 自动 | SEO 关键词 |
| **Cover** | URL | 自动 | AI 封面图 URL（存储在 Cloudflare R2） |
| **Published** | Checkbox | 手动 | 勾选 = 开始自动化发布流程 |
| **PublicationDate** | Date | 自动 | 发布时间戳 |
| **Created time** | Created Time | 自动 | Notion 默认字段 |
| **Last edited time** | Last Edited Time | 自动 | Notion 默认字段 |

**工作流程：**
- 用户从 Draft 中选择内容，手动编写中文终稿
- 用户设置 Language = "简体中文"
- 用户勾选 Published 后：
  - 自动翻译为 EN 和繁体中文
  - 自动生成 SEO ICU（每种语言）
  - 自动生成封面图（上传到 Cloudflare R2）
  - 自动创建对应语言版本的 Blog 条目
  - 自动推送到 Playfish 网站

---

## 📌 四、自动化流程（Automation Pipeline）

### 🟦 1. **Source Runner（自动生成 Title + SourceID）**

**触发方式：**
- Notion webhook：当新页面加入 Source DB
- 或 Vercel Cron 轮询（每 1~5 分钟）

**功能：**
- 读取 Page Content
- 用 GPT 生成：
  - Title（倾向使用小红书标题）
  - SourceID（格式：`src_0001`）
- 写回 Notion

---

### 🟩 2. **Draft Runner（自动生成大纲/草稿）**

**触发方式：**
- 用户在 autowriter dashboard 中点"生成大纲"
- 或手动调用 API（POST `/api/draft-runner`）

**功能：**
- 从 Source Content + Title 获取信息
- 用 Rewrite007 流程生成：
  - 大纲
  - 草稿
  - 思考日志
- 写入 Draft DB
- 自动标记对应 Source 的 Status-Used = true

---

### 🟥 3. **Publish Runner（主自动化）**

**触发条件：**
当用户在 Blog DB 中勾选 `Published: true`

**自动执行流程：**

1. **翻译（用 GPT-4.1 mini）**
   - 英文版本
   - 繁体中文版本

2. **SEO ICU 自动生成**
   - 标题 / 描述 / keywords（每种语言）

3. **生成封面图（GPT-image-1）**
   - 上传到 Cloudflare R2
   - 获取公开 URL
   - 写回 Cover 字段

4. **写入到对应主题的 Blog DB**
   - 创建 EN 版本条目（Language = "English"）
   - 创建繁体中文版本条目（Language = "繁体中文"）
   - 包含：标题、正文、slug、ICU、cover、sourceID、draftID、PublicationDate

5. **通知（可选）**
   - 邮件
   - TG
   - Webhook
   - 在 dashboard 记录日志

---

## 📌 五、技术架构

### 技术栈
- **框架**: Next.js 16 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **部署**: Vercel
- **数据库**: Notion (3个数据库)
- **AI**: OpenAI API (GPT-5.1, GPT-4.1 mini, GPT-image-1)
- **存储**: Cloudflare R2 (图片)
- **认证**: Basic Auth

### 环境变量

```env
# App Config
NEXT_PUBLIC_APP_URL=https://autowriter.playfishlab.com

# OpenAI
OPENAI_API_KEY=
OPENAI_ORG_ID=
OPENAI_PROJECT_ID=

# Notion
NOTION_API_TOKEN=
NOTION_SOURCE_DB_ID=
NOTION_DRAFT_DB_ID=
NOTION_BLOG_MOYU_DB_ID=      # 摸鱼主题
NOTION_BLOG_FIRE_DB_ID=      # FIRE 主题
NOTION_BLOG_IMMIGRATION_DB_ID= # 移民主题
NOTION_WEBHOOK_SECRET=

# Cloudflare R2 Storage (for images)
CLOUDFLARE_ACCOUNT_ID=
CLOUDFLARE_ACCESS_KEY_ID=
CLOUDFLARE_SECRET_ACCESS_KEY=
CLOUDFLARE_R2_BUCKET_NAME=
CLOUDFLARE_R2_PUBLIC_URL=

# Security
CRON_SECRET_TOKEN=
BASIC_AUTH_USERNAME=
BASIC_AUTH_PASSWORD=

# Playfish Integration
PLAYFISH_API_BASE_URL=
PLAYFISH_API_TOKEN=
PLAYFISH_DEPLOY_WEBHOOK_URL=
```

---

## 📌 六、性能 & 成本（Cost Model）

### GPT-5.1（大纲/草稿）
每篇文章约：**$0.05～0.07**

### GPT-4.1 mini（翻译 EN & ZHT）
每篇文章约：**$0.02～0.03**

### GPT-image-1（封面图）
每篇约：**$0.04**

### 总计：
# ⭐ **每篇文章 ≈ $0.10–$0.15（约人民币 0.8～1.2 元）**

非常低，完美适合作为长期系统。

---

## 📌 七、安全措施

- 基础认证（Basic Auth）
- Token 鉴权（用于 API 自动调用）
- 禁止 Google 抓取（robots.txt）
- 禁止用户访问（仅 PM 自己）
- 内部域名：autowriter.playfishlab.com

---

## 📌 八、注意事项

### 数据库字段命名
- **Source DB**: Title, SourceID, Status-Used, Created time, Last edited time, Page Content
- **Draft DB**: Title, Reviewed, SourceID, DraftID, Created time, Last edited time, Page Content
- **Blog DB**: Title, Slug, SourceID, DraftID, Language, Content, ICU_Title, ICU_Description, ICU_Keywords, Cover, Published, PublicationDate, Created time, Last edited time

### 语言区分方式
- **不是通过不同的数据库区分语言**
- **而是通过 Blog DB 中的 Language 字段（Select）来区分**
- 三个 Blog DB 分别对应三个主题：摸鱼、FIRE、移民

### 图片存储
- 使用 **Cloudflare R2**（不是 Firebase Storage）
- 需要配置 CLOUDFLARE_R2_PUBLIC_URL 作为公开访问地址

### 触发机制
- Source Runner: Webhook 或 Cron 轮询
- Draft Runner: 手动触发（Dashboard 或 API）
- Publish Runner: 检测 Blog DB 中 Published 字段变化

### 错误处理
- 所有自动化流程需要有错误日志
- 失败时需要通知用户
- 支持重试机制

---

## 📌 九、Roadmap

### ✅ Phase 1（当前阶段）— 已完成
- 子域名 autowriter.playfishlab.com
- 3 DB 结构确定
- 流程确定（Source→Draft→Blog→Publish）

### 🚀 Phase 2（立即可做）
- 创建 autowriter 项目骨架（Next.js）✅
- 实现 Source Runner
- 实现 Draft Runner
- 实现 Publish Runner

### 🚀 Phase 3（后续增强）
- 建 Dashboard UI（查看日志 + 手动触发）
- 文章质量评分系统
- 自动关键词密度分析
- 自动图片生成多版本（社媒封面）

---

## 📌 十、最终总结

你正在建立一个 **个人级、低成本、自动化、可追溯、多语言、可扩展** 的完整内容生产系统。

你只做中文创作，其余所有 AI 能做的都自动化。

这是一台真正意义上的 **"个人 AI 写稿工厂"**。

