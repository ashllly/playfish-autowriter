# 📝 重要记忆：Notion 数据库命名规范

## 核心数据库名称（必须严格遵守）

### Blog 主题数据库（3个）
1. **Blog-Playfish** - 摸鱼/职场/效率/生活方式主题
2. **Blog-FIRE** - 财务独立/早退休/投资/理财主题
3. **Blog-Immigrant** - 全球移民/数字游民/海外生活主题

### 其他数据库
- **Playfish-Blog-Source** - 灵感库
- **Playfish-Blog-Auto-Draft** - 大纲/草稿库

## 关键规则

1. **targetBlog 值与 Notion DB 名称完全一致**：
   - `Playfish`（只有 P 大写）- 对应 Notion DB: Blog-Playfish
   - `FIRE`（全大写）- 对应 Notion DB: Blog-FIRE
   - `Immigrant`（首字母大写）- 对应 Notion DB: Blog-Immigrant

2. **代码中的映射关系**：
   ```typescript
   "Playfish" -> DB_IDS.BLOG_PLAYFISH -> Blog-Playfish
   "FIRE" -> DB_IDS.BLOG_FIRE -> Blog-FIRE
   "Immigrant" -> DB_IDS.BLOG_IMMIGRATION -> Blog-Immigrant
   ```

3. **环境变量命名**：
   - `NOTION_PLAYFISH_DB_ID`
   - `NOTION_FIRE_DB_ID`
   - `NOTION_IMMIGRATION_DB_ID`

4. **PF-Rewrite 输出**：`targetBlog` 字段必须返回 `"Playfish"`、`"FIRE"` 或 `"Immigrant"`（与 Notion DB 名称完全一致）

5. **PF-SEO 输入**：`BlogTheme` 字段使用相同的值（`Playfish`、`FIRE`、`Immigrant`）

## 注意事项

- ❌ 不要使用：`PlayFish`（P 和 F 大写）、`MoYu`、`Immigration`
- ✅ 必须使用：`Playfish`（只有 P 大写）、`FIRE`、`Immigrant`
- 大小写敏感，必须完全匹配 Notion 数据库名称

