# 手动触发指南

## 配置 Basic Auth

### 1. 配置环境变量

在 `.env` 或 `.env.local` 文件中添加：

```env
BASIC_AUTH_USERNAME=你的用户名
BASIC_AUTH_PASSWORD=你的密码
```

**注意**: 
- 开发环境下，如果未配置 Basic Auth，系统会自动允许访问（仅用于测试）
- 生产环境（Vercel）必须配置 Basic Auth

### 2. 在 Vercel 中配置环境变量

1. 登录 Vercel Dashboard
2. 进入项目设置 → Environment Variables
3. 添加 `BASIC_AUTH_USERNAME` 和 `BASIC_AUTH_PASSWORD`

---

## Source Runner 手动触发

### 方式 1: 使用测试页面（最简单）✨

1. 启动开发服务器: `npm run dev`
2. 访问: `http://localhost:3000/test/runner`
3. 点击按钮即可触发

### 方式 2: 使用 curl (推荐)

```bash
# 使用 Basic Auth
curl -X POST https://autowriter.playfishlab.com/api/runner/source \
  -u "你的BASIC_AUTH_USERNAME:你的BASIC_AUTH_PASSWORD"
```

### 方式 2: 使用 Postman / Insomnia

1. **Method**: POST (或 GET)
2. **URL**: `https://autowriter.playfishlab.com/api/runner/source`
3. **Authorization**: 
   - Type: Basic Auth
   - Username: `BASIC_AUTH_USERNAME` (从 .env 获取)
   - Password: `BASIC_AUTH_PASSWORD` (从 .env 获取)

### 方式 3: 本地开发测试

```bash
# 启动开发服务器
npm run dev

# 在另一个终端执行
curl -X POST http://localhost:3000/api/runner/source \
  -u "你的BASIC_AUTH_USERNAME:你的BASIC_AUTH_PASSWORD"
```

### 方式 4: 使用 Cron Token (直接调用 Cron 端点)

```bash
curl -X GET https://autowriter.playfishlab.com/api/cron/source-runner \
  -H "Authorization: Bearer 你的CRON_SECRET_TOKEN"
```

## 预期响应

**成功时:**
```json
{
  "success": true,
  "message": "Source Runner executed successfully",
  "data": {
    "processed": 2
  }
}
```

**失败时:**
```json
{
  "success": false,
  "error": "错误信息"
}
```

## 验证步骤

1. 在 Notion Source DB 创建一个新页面
2. 在正文中粘贴一些文本（或图片）
3. **不要填写** Title 和 SourceID
4. 手动触发 Source Runner
5. 检查 Notion，应该看到 Title 和 SourceID 被自动填充

