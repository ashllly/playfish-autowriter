# 📋 Notion 数据库字段清单

根据 `prompts.ts` 规则和代码实现，以下是需要在 Notion 中创建的字段。

---

## 🟦 Source DB (Playfish-Blog-Source) 字段清单

| 字段名 | 类型 | 必填 | 自动/手动 | 说明 | 示例值 |
|--------|------|------|-----------|------|--------|
| **Title** | Title | ✅ | 自动 | 从正文自动生成的小红书标题 | "如何避免情绪内耗" |
| **TargetBlog** | Select | ☐ | 手动 | 手动指定目标博客，防止 AI 误判 | `Playfish` / `FIRE` / `Immigrant` |
| **SourceID** | Text (Rich Text) | ✅ | 自动 | 唯一标识符 | `src_abc12345` |
| **Send** | Checkbox | ✅ | 手动 | 勾选后触发 Draft Runner | ☑️ / ☐ |
| **Used** | Checkbox | ✅ | 自动 | 勾选表示已生成 Draft | ☑️ / ☐ |
| **Created time** | Created Time | ✅ | 自动 | Notion 默认字段 | 自动 |
| **Last edited time** | Last Edited Time | ✅ | 自动 | Notion 默认字段 | 自动 |
| **正文** | Page Content | ✅ | 手动 | 用户粘贴图片 + 文本 | (页面内容) |

### 字段配置说明：

1. **Title** (Title 类型)
   - 这是 Notion 的默认 Title 字段
   - 系统会自动生成，用户也可以手动修改

2. **TargetBlog** (Select 类型)
   - 用户手动指定
   - 选项值必须精确匹配：`Playfish` / `FIRE` / `Immigrant`
   - 如果手动指定了此值，后续流程将强制使用此值，忽略 AI 的判断

3. **SourceID** (Text 类型，Rich Text)
   - 格式：`src_` + 8位随机字符
   - 用于追踪和关联

3. **Send** (Checkbox)
   - 用户手动勾选
   - 勾选后且 `Used` 未勾选时，会触发 Draft Runner

4. **Used** (Checkbox)
   - 系统自动勾选
   - 当 Draft 生成完成后，系统会自动勾选此字段
   - 重试机制：如需重跑，取消勾选 `Used`（保持 `Send` 勾选）即可

5. **Lang** (Select)
   - 语言标签：`zh-hans` (简体中文) / `zh-hant` (繁体中文) / `en` (英文)
   - 系统自动写入 `zh-hans`

6. **正文** (Page Content)
   - 用户在页面中粘贴内容（图片、文字等）
   - 这是 Notion 的页面内容，不是数据库字段

---

## 🟩 Draft DB (Playfish-Blog-Auto-Draft) 字段清单

### 基础字段（必需）

| 字段名 | 类型 | 必填 | 自动/手动 | 说明 | 选项值 |
|--------|------|------|-----------|------|--------|
| **Title** | Title | ✅ | 自动 | 大纲标题（从 outline 提取） | "如何避免情绪内耗" |
| **TargetBlog** | Select | ✅ | 自动 | GPT 判断的目标博客 | `Playfish` / `FIRE` / `Immigrant` |
| **SourceID** | Text (Rich Text) | ✅ | 自动 | 对应 Source DB 的 SourceID | `src_abc12345` |
| **DraftID** | Text (Rich Text) | ✅ | 自动 | 唯一标识符 | `draft_xyz67890` |
| **Lang** | Select | ✅ | 自动 | 语言标签 | `zh-hans` |
| **Created time** | Created Time | ✅ | 自动 | Notion 默认字段 | 自动 |
| **Last edited time** | Last Edited Time | ✅ | 自动 | Notion 默认字段 | 自动 |

### 内容字段（可选，用于更好的查询和筛选）

**选项 1：所有内容在 Page Content 中（当前实现）**
- **正文** (Page Content) - 自动生成，包含：
  - `# 角度分析` + angle
  - `# 大纲` + outline
  - `# 正文` + draft
  - `## 思考日志` + thinkLog

**选项 2：作为独立字段（推荐，便于查询）**

| 字段名 | 类型 | 必填 | 自动/手动 | 说明 |
|--------|------|------|-----------|------|
| **Angle** | Text (Rich Text) | ⚠️ | 自动 | STEP 0-2 的完整分析（素材识别、可扩展议题、SEO分析、切入角度等） |
| **Outline** | Text (Rich Text) | ⚠️ | 自动 | STEP 4 的 SEO 大纲（H1-H3，Markdown 格式） |
| **Draft** | Text (Rich Text) | ⚠️ | 自动 | STEP 5 的完整正文内容（Playfish × 咪蒙风格，Markdown 格式） |
| **ThinkLog** | Text (Rich Text) | ⚠️ | 自动 | 整个思考过程的日志（包括 STEP 1-3 的完整思考过程） |
| **正文** | Page Content | ⚠️ | 自动 | 完整文章内容（可选，用于展示） |

### 字段配置说明：

1. **Title** (Title 类型)
   - 从 `outline` 的第一行（H1）提取
   - 如果提取失败，使用 Source DB 的 Title

2. **TargetBlog** (Select 类型)
   - ⚠️ **重要**：选项值必须与 Notion DB 名称完全一致
   - 选项值（必须精确匹配）：
     - `Playfish` (对应 Blog-Playfish，只有 P 大写)
     - `FIRE` (对应 Blog-FIRE)
     - `Immigrant` (对应 Blog-Immigrant)
   - 不允许使用：`PlayFish`（P 和 F 大写）、`MoYu`、`Immigration` 等

3. **SourceID** (Text 类型，Rich Text)
   - 从 Source DB 复制过来
   - 用于关联追溯

4. **DraftID** (Text 类型，Rich Text)
   - 格式：`draft_` + 8位随机字符
   - 用于唯一标识

5. **内容字段（Angle / Outline / Draft / ThinkLog）**
   - **当前实现**：所有内容都在 Page Content 中，格式如下：
     ```
     # 角度分析
     [STEP 0-2 的完整分析]
     
     # 大纲
     [STEP 4 的 SEO 大纲]
     
     # 正文
     [STEP 5 的完整正文内容]
     
     ---
     
     ## 思考日志
     [STEP 1-3 的完整思考过程]
     ```
   - **推荐方案**：如果需要在 Notion 中更好地查询和筛选，可以添加独立字段：
     - `Angle` (Text/Rich Text) - 角度分析
     - `Outline` (Text/Rich Text) - 大纲
     - `Draft` (Text/Rich Text) - 正文
     - `ThinkLog` (Text/Rich Text) - 思考日志
   - 如果添加独立字段，代码需要相应更新以写入这些字段

---

## 🟥 Blog DB (Blog-Playfish / Blog-FIRE / Blog-Immigrant) 字段清单

### 基础字段（必需）

| 字段名 | 类型 | 必填 | 自动/手动 | 说明 | 选项值 |
|--------|------|------|-----------|------|--------|
| **Title** | Title | ✅ | 自动 | 文章标题（从 Draft DB 提取） | "如何避免情绪内耗" |
| **Slug** | Text (Rich Text) | ✅ | 自动 | SEO 友好 URL 片段 | "avoid-emotional-burnout" |
| **SourceID** | Text (Rich Text) | ✅ | 自动 | 对应 Source DB 的 SourceID | `src_abc12345` |
| **DraftID** | Text (Rich Text) | ✅ | 自动 | 对应 Draft DB 的 DraftID | `draft_xyz67890` |
| **Lang** | Select | ✅ | 自动 | 语言标签 | `zh-hans` / `zh-hant` / `en` |
| **Content** | Page Content | ✅ | 自动 | 文章正文内容（从 Draft DB 提取） | (Markdown 格式) |
| **meta-title** | Text (Rich Text) | ✅ | 自动 | SEO 标题 | "如何走出低谷：实用的自我恢复方法" |
| **Description** | Text (Rich Text) | ✅ | 自动 | SEO 描述 | "本文从实操角度介绍..." |
| **Keywords** | Text (Rich Text) | ✅ | 自动 | SEO 关键词 | "情绪管理, 内耗, 自我提升" |
| **Tag** | Multi-select | ⚠️ | 自动 | 文章标签 | `摸鱼艺术`, `时间管理` |
| **TagSlug** | Text (Rich Text) | ⚠️ | 自动 | 标签对应的 URL Slug | `art-of-fish, time-management` |
| **Section** | Select | ✅ | 自动 | 网站发布板块 | `playfish` / `fire` / `immigrant` |
| **Cover** | URL | ☐ | 手动 | AI 封面图 URL | `https://r2.cloudflarestorage.com/...` |
| **Published** | Checkbox | ✅ | 手动 | 勾选 = 开始自动化发布流程 | ✅ / ☐ |
| **PublicationDate** | Date | ✅ | 自动 | 发布时间戳 | 自动 |
| **Created time** | Created Time | ✅ | 自动 | Notion 默认字段 | 自动 |
| **Last edited time** | Last Edited Time | ✅ | 自动 | Notion 默认字段 | 自动 |

### 字段配置说明：

1. **Title** (Title 类型)
   - 从 Draft DB 的 `outline` 第一行提取

2. **Slug** (Text 类型，Rich Text)
   - 由 PF-SEO 生成

3. **SourceID** (Text 类型，Rich Text)
   - 从 Draft DB 复制过来

4. **DraftID** (Text 类型，Rich Text)
   - 从 Draft DB 复制过来

5. **Lang** (Select 类型)
   - ⚠️ **重要**：选项值必须精确匹配：`zh-hans` / `zh-hant` / `en`
   - 默认写入 `zh-hans`

6. **Content** (Page Content)
   - 从 Draft DB 的 `draft` 部分提取

7. **meta-title** (Text 类型，Rich Text)
   - 由 PF-SEO 生成

8. **Description** (Text 类型，Rich Text)
   - 由 PF-SEO 生成

9. **Keywords** (Text 类型，Rich Text)
   - 由 PF-SEO 生成

10. **Tag** (Multi-select 类型)
    - 由 PF-SEO 生成，优先匹配预定义列表

11. **TagSlug** (Text 类型，Rich Text)
    - 由 PF-SEO 生成，对应 Tag 的 Slug (逗号分隔)

12. **Section** (Select 类型)
    - 网站发布板块，用于前端路由
    - 自动映射规则：
      - TargetBlog="Playfish" -> `playfish`
      - TargetBlog="FIRE" -> `fire`
      - TargetBlog="Immigrant" -> `immigrant`
    - 选项值必须为全小写

13. **Cover** (URL 类型)
    - 用户手动粘贴图片 URL

13. **Published** (Checkbox)
    - 用户手动勾选，触发发布流程

14. **PublicationDate** (Date 类型)
    - 系统自动写入发布时间

---

## ⚠️ 重要注意事项

### 1. TargetBlog 字段配置
- **字段类型**：Select（下拉选择）
- **选项值必须精确匹配**：
  - ✅ `Playfish` (只有 P 大写)
  - ✅ `FIRE` (全大写)
  - ✅ `Immigrant` (首字母大写)
- ❌ **不要使用**：`PlayFish` (P 和 F 大写)、`MoYu`、`Immigration` 等

### 2. 字段名大小写
- 代码中使用的字段名：
  - `Title` (首字母大写)
  - `SourceID` (驼峰命名)
  - `DraftID` (驼峰命名)
  - `TargetBlog` (驼峰命名)
  - `Send` (首字母大写)
  - `Used` (首字母大写)

### 3. 字段顺序建议
建议在 Notion 中按以下顺序排列字段（便于查看）：
1. Title
2. TargetBlog (Draft DB 特有)
3. SourceID
4. DraftID (Draft DB 特有)
5. Send (Source DB 特有)
6. Used
7. Created time
8. Last edited time

---

## 📝 创建步骤

### Source DB 创建步骤：
1. 创建新的 Database
2. 添加 Title 字段（默认已有）
3. 添加 Select 字段，命名为 `TargetBlog` (选项: `Playfish`, `FIRE`, `Immigrant`)
4. 添加 Text 字段，命名为 `SourceID`
4. 添加 Checkbox 字段，命名为 `Send`
5. 添加 Checkbox 字段，命名为 `Used`
6. Created time 和 Last edited time 是 Notion 默认字段，自动存在

### Draft DB 创建步骤：
1. 创建新的 Database
2. 添加 Title 字段（默认已有）
3. 添加 Select 字段，命名为 `TargetBlog`
   - 添加选项：`Playfish`（只有 P 大写）、`FIRE`、`Immigrant`
4. 添加 Text 字段，命名为 `SourceID`
5. 添加 Text 字段，命名为 `DraftID`
6. Created time 和 Last edited time 是 Notion 默认字段，自动存在

### Blog DB 创建步骤（Playfish / FIRE / Immigrant）：
1. 创建新的 Database
2. 添加基础字段：`Title`, `Slug`, `SourceID`, `DraftID`, `Lang`, `meta-title`, `Description`, `Keywords`
3. 添加 **Tag** (Multi-select) 和 **TagSlug** (Text)
4. 添加 **Section** (Select, 选项: `playfish`, `fire`, `immigrant`)
5. 添加 `Cover` (URL), `Published` (Checkbox), `PublicationDate` (Date)
6. Created time 和 Last edited time 是 Notion 默认字段，自动存在

---

## ✅ 验证清单

创建完成后，请验证：

- [ ] Source DB 有 `Title`、`TargetBlog`、`SourceID`、`Send`、`Used` 字段
- [ ] Draft DB 有 `Title`、`TargetBlog`、`SourceID`、`DraftID` 字段
- [ ] Blog DB 有 `Tag` (Multi-select) 和 `TagSlug` (Text) 字段
- [ ] `TargetBlog` 的选项值完全匹配：`Playfish`（只有 P 大写）、`FIRE`、`Immigrant`
- [ ] 字段名大小写正确（驼峰命名）
- [ ] 所有字段类型正确

