# 🐟 Playfish AutoWriter 产品文档

> 项目代号：**写稿打工仔（Playfish AutoWriter）**  
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
🌱 阶段1：灵感输入（完全手动）
小红书截图 → Source DB → (自动生成 Title/ID)

⚙️ 阶段2：自动写草稿（用户勾选 Send 后自动触发）
用户勾选 Send → 自动触发 Draft Runner
                          ↓
调用 GPT-5.1 (PF-Rewrite) → Draft DB
                          ↓
生成：角度分析、大纲、草稿、思考日志
                          ↓
GPT 判断 TargetBlog (Immigrant/Playfish/FIRE) - 对应 Notion DB: Blog-Immigrant / Blog-Playfish / Blog-FIRE
                          ↓
自动将草稿内容贴入对应 Blog DB（标题、正文、语言=简体）
                          ↓
触发 PF-SEO → 自动写入 SEO 信息

✍️ 阶段3：审核与发布（手动审核 + 自动发布）
用户审核草稿 → 手动生成封面图 → 手动贴入 URL
                          ↓
手动勾选 Published
                          ↓
触发：简体版发布到 Playfish 主网站
                          ↓
触发：翻译成多语言（EN/繁体）
```

---

## 📌 二、项目目标

### 🎯 **目标 1：让写文章的人只做"贴图 + 审核"这两件事**

你不需要：
- 写大纲
- 写初稿
- 翻译
- 写 SEO
- 生成封面图（手动生成但只需贴 URL）
- 部署文章

你只需要：
> **在 Source DB 贴图 → 勾选 Send → 审核草稿 → 手动贴封面图 URL → 勾选 Published ✔**

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
| **Send** | Checkbox | 手动 | 勾选后触发 Draft Runner |
| **Used** | Checkbox | 自动 | 勾选表示已生成 Draft，防止重复触发 |
| **Created time** | Created Time | 自动 | Notion 默认字段 |
| **Last edited time** | Last Edited Time | 自动 | Notion 默认字段 |
| **正文（Page Content）** | Page Content | 手动 | 用户粘贴图片 + 文本 |

**工作流程：**
- 用户在 Source DB 创建新记录
- 在正文里贴上小红书截图或内容
- 系统自动生成 Title 和 SourceID
- 用户勾选 Send 后，触发 Draft Runner（前提：Used 未勾选）
- Draft 生成完成后，系统自动勾选 Used
- **重试机制**：如果需要重跑，只需手动取消 Used 勾选（保持 Send 勾选）即可再次触发

---

### 🟩 2. **Playfish-Blog-Auto-Draft（大纲/草稿库）**

| 字段名 | 类型 | 自动/手动 | 说明 |
|--------|------|-----------|------|
| **Title** | Title | 自动 | 大纲标题（GPT 生成） |
| **TargetBlog** | Select | 自动 | GPT 自行判断：Immigrant / Playfish / FIRE（对应 Notion DB: Blog-Immigrant / Blog-Playfish / Blog-FIRE） |
| **SourceID** | Text | 自动 | 对应 Source DB 的 SourceID |
| **DraftID** | Text | 自动 | 例如 `draft_0001` |
| **Created time** | Created Time | 自动 | Notion 默认字段 |
| **Last edited time** | Last Edited Time | 自动 | Notion 默认字段 |
| **正文（Page Content）** | Page Content | 自动 | 包含角度分析、大纲、草稿、思考日志等 |

**工作流程：**
- **完全自动触发**：当 Source DB 中 status="pending" 的记录被检测到
- 系统自动调用 GPT-5.1（PF-Rewrite 命令集）生成：
  - 角度分析
  - 大纲
  - 文章草稿（简体中文）
  - 思考日志（全部保留）
- GPT 自动判断 TargetBlog（Immigrant/Playfish/FIRE，对应 Notion DB: Blog-Immigrant / Blog-Playfish / Blog-FIRE）
- 系统自动将草稿内容贴入对应 Blog DB：
  - 标题 → Title
  - 正文 → Content
  - 语言 → Language = "简体中文"
- 触发 PF-SEO 命令集，自动写入 SEO 信息到对应 Blog DB

---

### 🟥 3. **Playfish-Blog（正式稿库）**

**重要：博客不是按语言区分的，而是按照三大主题分类：**
- **摸鱼** - Notion DB 名称：**Blog-Playfish**
- **FIRE** - Notion DB 名称：**Blog-FIRE**
- **移民** - Notion DB 名称：**Blog-Immigrant**

**每个主题的 Blog DB 结构：**

| 字段名 | 类型 | 自动/手动 | 说明 |
|--------|------|-----------|------|
| **Title** | Title | 手动 | 中文标题（用户写） |
| **Slug** | Text | 自动 | autowriter 或 blog 生成 |
| **SourceID** | Text | 手动/自动 | 方便追溯 |
| **DraftID** | Text | 手动/自动 | 方便追溯 |
| **Language** | Select | 手动/自动 | 语言标签：简体中文 / 繁体中文 / English |
| **Content** | Page Content | 手动 | 正文内容 |
| **meta-title** | Text | 自动 | SEO 标题 (PF-SEO 生成) |
| **Description** | Text | 自动 | SEO 描述 (PF-SEO 生成) |
| **Keywords** | Text | 自动 | SEO 关键词 (PF-SEO 生成) |
| **Cover** | URL | 自动 | AI 封面图 URL（存储在 Cloudflare R2） |
| **Published** | Checkbox | 手动 | 勾选 = 开始自动化发布流程 |
| **PublicationDate** | Date | 自动 | 发布时间戳 |
| **Created time** | Created Time | 自动 | Notion 默认字段 |
| **Last edited time** | Last Edited Time | 自动 | Notion 默认字段 |

**工作流程：**
- 系统自动从 Draft DB 将内容贴入对应 Blog DB（标题、正文、语言=简体、SEO 信息）
- 用户审核草稿内容，可手动调整
- 用户手动生成封面图，将 URL 手动贴入 Cover 字段
- 用户手动勾选 Published 后：
  - 触发：简体版文章发布到 Playfish 主网站（这是 Playfish 主网站 project 功能，与 autowriter 不互相影响）
  - 触发：翻译成多语言（EN/繁体）- 将创建相应命令集

---

## 📌 四、完整自动化流程（Automation Pipeline）

### 🌱 阶段 1：灵感输入（完全手动）

**你做的事情：**
- 在 Source DB 创建一条新记录
- 在正文里贴上小红书截图或内容
- 什么都不用填（Title、SourceID 自动生成）

**字段填写方式：**

| 字段 | 填写方式 |
|------|----------|
| Content（正文） | ✔ 你手动贴图/贴文字 |
| Title | ❌ 自动生成（ChatGPT） |
| SourceID | ❌ 自动生成（UUID） |
| CreatedTime | ❌ 自动写入 |
| Send | ✔ 你手动勾选（触发下一步） |

➡️ **你只需要贴图 + 勾选 Send。**

---

### ⚙️ 阶段 2：自动写草稿（用户勾选 Send 后自动触发）

**触发条件：**
当用户在 Source DB 中勾选 `Send` **且** `Used` 为空（未勾选）时，系统自动触发。

**自动执行流程：**

1. **读取 Source DB 记录**
   - 内容（图片/文字）
   - 自动生成 Title
   - 自动生成 SourceID

2. **调用 GPT-5.1（使用命令集 PF-Rewrite）生成：**
   - 角度分析
   - 大纲
   - 文章草稿（简体中文）
   - 思考日志（全部保留）

3. **自动写入 Draft DB：**
   - Title（大纲标题）
   - SourceID（对应 Source）
   - DraftID（自动生成）
   - TargetBlog（GPT 自行判断：Immigrant/Playfish/FIRE，对应 Notion DB: Blog-Immigrant / Blog-Playfish / Blog-FIRE）
   - 正文（包含角度分析、大纲、草稿、思考日志）

4. **自动将 Draft 中的正文部分，贴入对应博客数据库（三个博客主题中的一个）：**
   - 标题 → Blog DB 的 Title 字段
   - 正文 → Blog DB 的 Content 字段
   - 语言 → Blog DB 的 Language = "简体中文"
   - SourceID、DraftID → 对应字段

5. **触发命令集 PF-SEO，自动写入对应博客数据库的 SEO 信息：**
   - meta-title
   - Description
   - Keywords

6. **Draft 生成完成后，系统自动勾选 Source DB 的 Used**
   - 此时 `Send`=✅, `Used`=✅ -> 流程结束，不会重复触发
   - 如需重跑，手动取消 `Used` 即可

---

### ✍️ 阶段 3：审核与发布（手动审核 + 自动发布）

**你做的事情：**
1. 审核草稿内容（可手动调整）
2. 手动生成封面图
3. 将封面图 URL 手动贴入 Blog DB 的 Cover 字段
4. 手动将状态变为 Published（通过 checkbox）

**自动执行流程（当 Published = true 时）：**

1. **触发简体版文章发布到网上**
   - 这是 Playfish 主网站 project 功能
   - 与 autowriter 不互相影响

2. **触发翻译成多语言（将创建相应命令集，暂时还没有）**
   - 英文版本
   - 繁体中文版本
   - 自动创建对应语言版本的 Blog 条目

---

### 🔧 技术实现细节

**Source Runner（自动生成 Title + SourceID）**
- 触发方式：手动触发，或Notion webhook 或 Vercel Cron 轮询（每 30 分钟）
- 功能：读取 Page Content，用 GPT 生成 Title 和 SourceID，写回 Notion

**Draft Runner（自动生成大纲/草稿）**
- 触发方式：**用户勾选 Send 后自动触发**，检测 Source DB 中 `Send=true` 且 `Used=false` 的记录
- 功能：调用 GPT-5.1（PF-Rewrite），生成草稿，判断 TargetBlog，自动贴入对应 Blog DB，触发 PF-SEO，最后勾选 Used

**Publish Runner（发布流程）**
- 触发条件：Blog DB 中 Published 字段变为 true
- 功能：发布简体版到 Playfish 主网站，触发多语言翻译（待实现）

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
NOTION_BLOG_PLAYFISH_DB_ID=      # 摸鱼主题 (Notion DB: Blog-Playfish)
NOTION_BLOG_FIRE_DB_ID=      # FIRE 主题 (Notion DB: Blog-FIRE)
NOTION_BLOG_IMMIGRATION_DB_ID= # 移民主题 (Notion DB: Blog-Immigrant)
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
- **Source DB**: Title, SourceID, Send (Checkbox), Used (Checkbox), Created time, Last edited time, Page Content
- **Draft DB**: Title, TargetBlog (Select: Immigrant/Playfish/FIRE，对应 Notion DB: Blog-Immigrant / Blog-Playfish / Blog-FIRE), SourceID, DraftID, Created time, Last edited time, Page Content
- **Blog DB**: Title, Slug, SourceID, DraftID, Language (Select: 简体中文/繁体中文/English), Content, meta-title, Description, Keywords, Cover, Published, PublicationDate, Created time, Last edited time

### 语言区分方式
- **不是通过不同的数据库区分语言**
- **而是通过 Blog DB 中的 Language 字段（Select）来区分**
- 三个 Blog DB 分别对应三个主题：摸鱼、FIRE、移民

### 图片存储
- 使用 **Cloudflare R2**（不是 Firebase Storage）
- 需要配置 CLOUDFLARE_R2_PUBLIC_URL 作为公开访问地址

### 触发机制
- **Source Runner**: Webhook 或 Cron 轮询（检测新记录，自动生成 Title 和 SourceID）
- **Draft Runner**: **用户勾选 Send 后自动触发**，检测 Source DB 中 `Send=true` 且 `Used=false` 的记录，自动生成草稿并贴入对应 Blog DB，完成后勾选 Used
- **Publish Runner**: 检测 Blog DB 中 Published 字段变化（用户手动勾选后触发）

### OpenAI 命令集（Command Sets）
- **PF-Rewrite**: 用于 Draft Runner，生成角度分析、大纲、草稿、思考日志
- **PF-SEO**: 用于自动生成 SEO 信息（meta-title, Description, Keywords）
- **翻译命令集**: 待创建，用于多语言翻译（EN/繁体）

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

