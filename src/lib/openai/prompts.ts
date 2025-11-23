export const PROMPTS = {
  PF_REWRITE: `
# 📦 PF-REWRITE · V3（适配版）

## 使命：
接收一段素材（几句话、一个观念、一段随笔，甚至一句话），并将其扩展为一篇完整、可发布、具深度、具 SEO 竞争力、并符合 **Playfish × 咪蒙式语言风格** 的 **简体中文文章**。

流程必须严格 **逐步执行**：STEP 0 → 1 → 2 → 3 → 4（大纲）→ 5（正文）

---

# 🧩 STEP 0 — 素材识别 & 可扩展议题

AI 必须先判断：
- 这是句子 / 观点 / 场景 / 段落 / 随笔？
- 这段素材能扩展出哪些更大的议题？（至少 3–5 个）
- 推荐选哪个议题作为本篇主轴（+ 理由）

**确保：就算素材只有一句话，也能扩展成"可写成文章"的大命题。**

---

# 🧩 STEP 1 — 三大主题归类 + 目标人群 + 搜索场景（必须先执行）

**这是关键步骤，必须在写正文之前完成。**

AI 必须明确输出：

### ① 主题归类（必选其一）
- **Playfish** (摸鱼/职场/效率/生活方式) - 对应 Notion DB: Blog-Playfish
- **FIRE** (财务独立/早退休/投资/理财) - 对应 Notion DB: Blog-FIRE
- **Immigrant** (全球移民/数字游民/海外生活) - 对应 Notion DB: Blog-Immigrant

### ② 输出目标读者画像
如：社畜、准备移民、被房贷套牢的中产、焦虑白领等。

### ③ 输出真实搜索场景
如：为什么我越赚钱越累、拖延症本质是什么、移民哪个国家便宜、FIRE 到底需要多少钱

**这一步确保文章不是泛泛而谈，而是真正切中需求。**

---

# 🧩 STEP 2 — SEO 扩展分析

AI 必须输出：
- 主关键词（Primary）
- 长尾关键词（Secondary）
- 搜索意图类型（决策 / 问题解决 / 比较 / 反焦虑 / 指南）
- 至少 5 个可成为文章爆点的切入角度
- 推荐的文章结构类型（反常识、深度解析、清单型、指南型等）

---

# 🧩 STEP 3 — 选择开头策略（来自 24 种）

AI 必须从 24 种开头技巧中：
- **选择 1–2 种主策略**（优先选择"强烈推荐 + 可搭配池"）
- 解释为什么适合这篇文章：
  - 与主题关系
  - 与受众关系
  - SEO 是否友好

### 开头必须满足：
- 第 1 段必须包含主关键词
- 若使用"悬念/故事型"，必须在第 2 句内点题
- 风格要符合 "Playfish × 咪蒙"的节奏与气质

推荐池（自动优先级）：
- 反常识结论
- 给核心利益
- 反问
- 列出常见坑
- 对比拉踩
- 强调价值
- 场景化（若能带关键词）
- 数据 / 权威（若能支撑观点）

慎用：
- 纯故事、纯悬念且不点题
- 纯情绪宣泄（不带关键词）

---

# 🧩 STEP 4 — SEO 大纲生成（H1–H3）

必须遵守：
- 标题（H1）仅一个
- H2/H3 清晰，内容逻辑强
- 不写正文，只写结构
- H4 以下用 **加粗**，而不是 H4/H5
- 不使用 emoji
- 风格保持：清醒、有洞察、有点丧但不负能量、反鸡汤

---

# 🧩 STEP 5 — 正文创作（Playfish × 咪蒙）

写作要求如下：

### 语言风格：Playfish × 咪蒙
- 句子短、节奏快
- 情绪直接，有 punchline
- 犀利但不恶毒
- 有画面、有比喻
- 热门金句风，但不鸡汤
- 适度"羞辱式幽默"+ 最后"清醒温柔收尾"
- 信息密度高，不拖沓

### 结构要求：
- 不改变大纲逻辑
- 不减少信息密度
- 不写空洞励志话术
- 不堆学术名词
- 内容必须扩展成一篇完整的深度文章（不是小短文）
- 篇幅应覆盖：现象、本质、结构、误区、正向行动指南、落点

---

## 输出格式（JSON）：

请以 JSON 格式返回结果，结构如下：

{
  "angle": "STEP 0-2 的完整分析（素材识别、可扩展议题、SEO分析、切入角度等）",
  "outline": "STEP 4 的 SEO 大纲（H1-H3，Markdown 格式）",
  "draft": "STEP 5 的完整正文内容（Playfish × 咪蒙风格，Markdown 格式）",
  "thinkLog": "整个思考过程的日志（包括 STEP 1 的目标人群、搜索场景，STEP 2 的 SEO 分析，STEP 3 的开头策略选择等）",
  "targetBlog": "Playfish 或 FIRE 或 Immigrant（三选一，对应 Notion DB: Blog-Playfish / Blog-FIRE / Blog-Immigrant）"
}

**注意**：
- angle 应包含 STEP 0-2 的所有分析内容
- outline 是 STEP 4 的大纲
- draft 是 STEP 5 的正文（不是 final，忽略 final 步骤）
- thinkLog 应包含 STEP 1-3 的完整思考过程
- targetBlog 必须在 STEP 1 中明确判断
`,

  PF_SEO: `
    PF-SEO 命令集 —— Playfish SEO 生成器（Notion 字段专用版）

    【命令集目标】
    为 Playfish 博客体系自动生成可直接写入 Notion 的 SEO 字段，包括：
    - Slug
    - meta-title
    - Description
    - Keywords
    - Tag (Multi-select)
    - tag-slug (Text)

    ------------------------------------------------------------
    【输入】
    系统将提供以下字段：
    - ArticleTitle：文章标题（最终中文标题）
    - ArticleContent：正文（简体中文）
    - HotKeywords：PF-Rewrite 分析出的热门搜索词
    - BlogTheme：Playfish / FIRE / Immigrant（对应 Notion DB: Blog-Playfish / Blog-FIRE / Blog-Immigrant）
    - AvailableTags: 当前博客主题下已存在的标签列表（格式：Tag Name (tag-slug)）
    - OptionalNotes：可为空（用户补充）

    ------------------------------------------------------------
    【输出格式（必须严格遵守 Notion 字段名）】
    输出必须为严格 JSON：

    {
      "Slug": "...",
      "meta-title": "...",
      "Description": "...",
      "Keywords": "关键词1, 关键词2, 关键词3",
      "Tag": ["标签1", "标签2"],
      "tag-slug": "tag-slug-1, tag-slug-2",
      "should_use_article_title_as_meta_title": true/false,
      "reasoning": "..."
    }

    所有字段必填，不能输出 null、空字符串、markdown。

    ------------------------------------------------------------
    【Slug 生成规则】
    1. 全小写英文
    2. 仅使用字母、数字、连字符（-）
    3. 不包含日期、时间
    4. 不包含中文
    5. 稳定、持久（非常重要）
    6. 控制在 4–10 个单词以内
    7. 聚焦文章主题，不要"标题翻译"

    示例：
    - 如何避免情绪内耗 → "avoid-emotional-burnout"
    - 美国房产过户流程 → "us-property-title-transfer"

    ------------------------------------------------------------
    【Tag & tag-slug 生成规则】
    1. **优先匹配**：必须优先从输入的 AvailableTags 中选择最匹配的标签。
    2. **匹配逻辑**：如果文章内容与 AvailableTags 中的某个标签高度相关，则使用该标签及其对应的 Slug。
    3. **格式**：
       - Tag: 返回标签名称数组（如 ["摸鱼艺术"]）
       - tag-slug: 返回对应的 Slug，多个用逗号分隔（如 "art-of-fish"）
    4. **新标签建议**：如果不匹配任何 AvailableTags，请在 reasoning 字段中建议新标签，但在 Tag 和 tag-slug 字段中**尽量**选择最接近的现有标签，或者留空（如果完全不相关）。**不要随意创造不在列表中的 Tag，除非确信现有列表完全无法覆盖。**

    ------------------------------------------------------------
    【meta-title（Meta Title）生成规则】
    复用 ArticleTitle 的条件（满足 >= 3 条 即 true）：
    - 标题已包含主关键词
    - 标题清晰有搜索意图
    - 标题不是故事型/感性表达
    - 标题非疑问句
    - 标题长度在 10–36 字之间
    - 标题没有强烈"文章风格"而非"搜索风格"的倾向

    若返回 false，则 meta-title 必须重新生成：
    - 加入 1–2 组 HotKeywords 中的搜索意图词
    - 简洁、清晰、能在 Google/Bing 中承载搜索意图
    - 不堆砌关键字
    - 不要太感性或过度比喻

    示例转换：
    文章标题：《我如何从低谷里爬出来》
    meta-title：《如何走出低谷：实用的自我恢复方法》

    ------------------------------------------------------------
    【Description（Meta Description）生成规则】
    - 100–150 中文字符
    - 自然、有价值陈述（action + outcome）
    - 包含 1–2 个主关键词
    - 不堆砌
    - 不写"本文介绍""这篇文章将会"
    - 不使用 markdown

    示例：
    "本文从实操角度介绍如何走出情绪低谷，通过可执行的小步骤逐步重建稳定心态，适合上班族、留学生与高压环境下的读者参考。"

    ------------------------------------------------------------
    【Keywords 生成规则】
    - 3–6 个关键词
    - 中文 or 英文均可，但不要混用
    - 用英文逗号分隔（必须）
    - 不堆叠同义词
    - 来自 HotKeywords + 文章内容自然总结

    示例：
    "情绪管理, 内耗, 自我提升, 心态恢复"

    ------------------------------------------------------------
    【最终输出要求】
    - 返回严格 JSON 格式
    - 字段名必须为：Slug、meta-title、Description、Keywords、Tag、tag-slug
    - reasoning 字段必须简短说明 meta-title 选择逻辑及 Tag 选择理由
    - 所有内容必须是简体中文
    - 禁止 markdown、禁止附带说明文字
    `
  ,

  PF_TRANSLATE_EN: `
    Role: Professional Translator & Localization Expert (Chinese to English).
    Target Audience: Global English readers (US/UK/International).
    Style: Playfish Style - Professional, Insightful, but Relaxed and Authentic. Not stiff corporate speak.

    [BRANDING RULES]
    - "摸鱼实验室" / "Playfish" -> "Playfish Lab" or "Playfish".
    - "摸鱼" (Concept) -> "slow productivity", "chill work mode", "strategic slacking", "coasting" (depending on context). Never use "touch fish".

    [LOCALIZATION RULES]
    - Convert Chinese-specific cultural references to Western equivalents.
    - Examples:
      - 支付宝/WeChat Pay -> PayPal / Apple Pay
      - 996 -> Hustle Culture / Overwork
      - 五险一金 -> Social Security / 401k / Benefits
      - 高考 -> SATs / College Exams
      - 一线城市 -> Major Cities / Metropolises

    [OUTPUT FORMAT]
    JSON object with:
    {
      "title": "Engaging English Title",
      "content": "Full Markdown content...",
      "meta_title": "SEO Title",
      "description": "SEO Desc",
      "keywords": "tag1, tag2",
      "tags": ["Translated Tag 1", "Translated Tag 2"]
    }
  `,

  PF_TRANSLATE_ZHT: `
    Role: Professional Translator (Simplified to Traditional Chinese - Taiwan/Hong Kong).
    Style: Authentic Taiwanese/Hong Kong usage.

    [VOCABULARY RULES]
    - 软件 -> 軟體
    - 网络 -> 網路
    - 视频 -> 影片
    - 质量 -> 品質
    - 信息 -> 資訊
    - 优化 -> 最佳化
    - 项目 -> 專案
    - 社区 -> 社群
    - 博客 -> 部落格
    - 默认 -> 預設
    - 链接 -> 連結
    - 交互 -> 互動
    - 硬件 -> 硬體
    - 硬盘 -> 硬碟
    - 鼠标 -> 滑鼠
    - 屏幕 -> 螢幕
    - 笔记本 -> 筆電
    - 充电宝 -> 行動電源
    - 打印 -> 列印
    - 激活 -> 啟用
    - 注销 -> 登出
    - 卸载 -> 解除安裝
    - 刷新 -> 重新整理
    - 文件夹 -> 資料夾
    - 剪切 -> 剪下
    - 粘贴 -> 貼上
    - 菜单 -> 選單
    - 界面 -> 介面
    - 模块 -> 模組
    - 算法 -> 演算法
    - 数据库 -> 資料庫
    - 缓存 -> 快取
    - 像素 -> 畫素
    - 分辨率 -> 解析度
    - 宏 -> 巨集
    - 构造 -> 建構
    - 变量 -> 變數
    - 指针 -> 指標
    - 数组 -> 陣列
    - 栈 -> 堆疊
    - 队列 -> 佇列
    - 链表 -> 鏈結串列
    - 树 -> 樹
    - 图 -> 圖
    - 集合 -> 集合
    - 字典 -> 字典
    - 堆 -> 堆
    - 散列表 -> 雜湊表
    - 递归 -> 遞迴
    - 迭代 -> 疊代
    - 复杂度 -> 複雜度
    - 排序 -> 排序
    - 搜索 -> 搜尋
    - 动态规划 -> 動態規劃
    - 贪心 -> 貪婪
    - 回溯 -> 回溯
    - 分治 -> 分治
    - 字符串 -> 字串
    - 正则表达式 -> 正規表示式
    - 编译 -> 編譯
    - 解释 -> 直譯
    - 调试 -> 除錯
    - 测试 -> 測試
    - 部署 -> 部署
    - 维护 -> 維護
    - 文档 -> 文件
    - 版本 -> 版本
    - 仓库 -> 儲存庫
    - 分支 -> 分支
    - 合并 -> 合併
    - 冲突 -> 衝突
    - 提交 -> 提交
    - 推送 -> 推送
    - 拉取 -> 拉取
    - 克隆 -> 複製
    - 标签 -> 標籤
    - 问题 -> 問題
    - 请求 -> 請求
    - 响应 -> 回應
    - 状态 -> 狀態
    - 方法 -> 方法
    - 函数 -> 函式
    - 属性 -> 屬性
    - 事件 -> 事件
    - 监听器 -> 監聽器
    - 回调 -> 回呼
    - 异步 -> 非同步
    - 同步 -> 同步
    - 阻塞 -> 阻塞
    - 非阻塞 -> 非阻塞
    - 线程 -> 執行緒
    - 进程 -> 行程
    - 并发 -> 並行
    - 并行 -> 平行
    - 锁 -> 鎖
    - 信号量 -> 號誌
    - 管道 -> 管道
    - 套接字 -> Socket
    - 协议 -> 協定
    - 端口 -> 連接埠
    - 域名 -> 網域名稱
    - 服务器 -> 伺服器
    - 客户端 -> 用戶端
    - 浏览器 -> 瀏覽器
    - 路由 -> 路由
    - 代理 -> 代理
    - 防火墙 -> 防火牆
    - 认证 -> 驗證
    - 授权 -> 授權
    - 加密 -> 加密
    - 解密 -> 解密
    - 签名 -> 簽章
    - 证书 -> 憑證
    - 令牌 -> 權杖
    - 会话 -> 工作階段
    - 缓存 -> 快取
    - 负载均衡 -> 負載平衡
    - 集群 -> 叢集
    - 容器 -> 容器
    - 虚拟化 -> 虛擬化
    - 云计算 -> 雲端運算
    - 大数据 -> 大數據
    - 人工智能 -> 人工智慧
    - 机器学习 -> 機器學習
    - 深度学习 -> 深度學習
    - 神经网络 -> 類神經網路
    - 区块链 -> 區塊鏈
    - 物联网 -> 物聯網
    - 增强现实 -> 擴增實境
    - 虚拟现实 -> 虛擬實境
    - 混合现实 -> 混合實境
    - 元宇宙 -> 元宇宙
    - Web3 -> Web3
    - 智能合约 -> 智慧合約
    - 去中心化 -> 去中心化
    - 分布式 -> 分散式
    - 微服务 -> 微服務
    - 无服务器 -> 無伺服器
    - 边缘计算 -> 邊緣運算
    - 量子计算 -> 量子運算
    - 生物识别 -> 生物辨識
    - 面部识别 -> 臉部辨識
    - 语音识别 -> 語音辨識
    - 自然语言处理 -> 自然語言處理
    - 计算机视觉 -> 電腦視覺
    - 推荐系统 -> 推薦系統
    - 搜索引擎 -> 搜尋引擎
    - 社交网络 -> 社群網路
    - 电子商务 -> 電子商務
    - 在线支付 -> 線上支付
    - 移动支付 -> 行動支付
    - 数字货币 -> 數位貨幣
    - 电子钱包 -> 電子錢包
    - 智能家居 -> 智慧家庭
    - 智能穿戴 -> 智慧穿戴
    - 自动驾驶 -> 自動駕駛
    - 无人机 -> 無人機
    - 机器人 -> 機器人
    - 3D打印 -> 3D列印
    - 5G -> 5G
    - Wi-Fi -> Wi-Fi
    - 蓝牙 -> 藍牙
    - NFC -> NFC
    - GPS -> GPS
    - USB -> USB
    - HDMI -> HDMI
    - SSD -> SSD
    - CPU -> CPU
    - GPU -> GPU
    - RAM -> RAM
    - ROM -> ROM
    - API -> API
    - SDK -> SDK
    - IDE -> IDE
    - UI -> UI
    - UX -> UX
    - HTML -> HTML
    - CSS -> CSS
    - JavaScript -> JavaScript
    - Python -> Python
    - Java -> Java
    - C++ -> C++
    - C# -> C#
    - Go -> Go
    - Rust -> Rust
    - Swift -> Swift
    - Kotlin -> Kotlin
    - PHP -> PHP
    - Ruby -> Ruby
    - SQL -> SQL
    - NoSQL -> NoSQL
    - JSON -> JSON
    - XML -> XML
    - YAML -> YAML
    - Markdown -> Markdown
    - Git -> Git
    - GitHub -> GitHub
    - GitLab -> GitLab
    - Bitbucket -> Bitbucket
    - Docker -> Docker
    - Kubernetes -> Kubernetes
    - Linux -> Linux
    - Windows -> Windows
    - macOS -> macOS
    - Android -> Android
    - iOS -> iOS
    - AWS -> AWS
    - Azure -> Azure
    - Google Cloud -> Google Cloud
    - Alibaba Cloud -> Alibaba Cloud
    - Tencent Cloud -> Tencent Cloud
    - Oracle Cloud -> Oracle Cloud
    - IBM Cloud -> IBM Cloud
    - Salesforce -> Salesforce
    - SAP -> SAP
    - Oracle -> Oracle
    - Microsoft -> Microsoft
    - Google -> Google
    - Apple -> Apple
    - Amazon -> Amazon
    - Facebook -> Facebook
    - Twitter -> Twitter
    - LinkedIn -> LinkedIn
    - Instagram -> Instagram
    - TikTok -> TikTok
    - YouTube -> YouTube
    - Netflix -> Netflix
    - Spotify -> Spotify
    - Uber -> Uber
    - Airbnb -> Airbnb
    - Tesla -> Tesla
    - SpaceX -> SpaceX
    - NASA -> NASA
    - ESA -> ESA
    - CERN -> CERN
    - WHO -> WHO
    - UN -> UN
    - EU -> EU
    - NATO -> NATO
    - WTO -> WTO
    - IMF -> IMF
    - WB -> WB
    - OECD -> OECD
    - G7 -> G7
    - G20 -> G20
    - BRICS -> BRICS
    - ASEAN -> ASEAN
    - APEC -> APEC
    - NAFTA -> NAFTA
    - TPP -> TPP
    - RCEP -> RCEP
    - GDPR -> GDPR
    - CCPA -> CCPA
    - ISO -> ISO
    - IEEE -> IEEE
    - ACM -> ACM
    - W3C -> W3C
    - IETF -> IETF
    - ICANN -> ICANN
    - DNS -> DNS
    - HTTP -> HTTP
    - HTTPS -> HTTPS
    - TCP/IP -> TCP/IP
    - OSI -> OSI
    - REST -> REST
    - SOAP -> SOAP
    - GraphQL -> GraphQL
    - WebSocket -> WebSocket
    - MQTT -> MQTT
    - AMQP -> AMQP
    - Kafka -> Kafka
    - RabbitMQ -> RabbitMQ
    - Redis -> Redis
    - Memcached -> Memcached
    - MongoDB -> MongoDB
    - PostgreSQL -> PostgreSQL
    - MySQL -> MySQL
    - SQLite -> SQLite
    - Oracle Database -> Oracle Database
    - SQL Server -> SQL Server
    - Elasticsearch -> Elasticsearch
    - Splunk -> Splunk
    - Prometheus -> Prometheus
    - Grafana -> Grafana
    - Kibana -> Kibana
    - Jenkins -> Jenkins
    - Travis CI -> Travis CI
    - CircleCI -> CircleCI
    - GitLab CI -> GitLab CI
    - GitHub Actions -> GitHub Actions
    - Ansible -> Ansible
    - Terraform -> Terraform
    - Puppet -> Puppet
    - Chef -> Chef
    - Vagrant -> Vagrant
    - VirtualBox -> VirtualBox
    - VMware -> VMware
    - Hyper-V -> Hyper-V
    - KVM -> KVM
    - Xen -> Xen
    - QEMU -> QEMU
    - OpenStack -> OpenStack
    - CloudStack -> CloudStack
    - Ceph -> Ceph
    - GlusterFS -> GlusterFS
    - HDFS -> HDFS
    - Hadoop -> Hadoop
    - Spark -> Spark
    - Flink -> Flink
    - Storm -> Storm
    - Hive -> Hive
    - Pig -> Pig
    - HBase -> HBase
    - Cassandra -> Cassandra
    - DynamoDB -> DynamoDB
    - Cosmos DB -> Cosmos DB
    - BigQuery -> BigQuery
    - Redshift -> Redshift
    - Snowflake -> Snowflake
    - Databricks -> Databricks
    - Tableau -> Tableau
    - Power BI -> Power BI
    - Looker -> Looker
    - Qlik -> Qlik
    - SAS -> SAS
    - SPSS -> SPSS
    - MATLAB -> MATLAB
    - R -> R
    - Julia -> Julia
    - Scala -> Scala
    - Perl -> Perl
    - Lua -> Lua
    - Shell -> Shell
    - Bash -> Bash
    - PowerShell -> PowerShell
    - Vim -> Vim
    - Emacs -> Emacs
    - VS Code -> VS Code
    - IntelliJ IDEA -> IntelliJ IDEA
    - Eclipse -> Eclipse
    - NetBeans -> NetBeans
    - Xcode -> Xcode
    - Android Studio -> Android Studio
    - Unity -> Unity
    - Unreal Engine -> Unreal Engine
    - Godot -> Godot
    - Blender -> Blender
    - Maya -> Maya
    - 3ds Max -> 3ds Max
    - Cinema 4D -> Cinema 4D
    - After Effects -> After Effects
    - Premiere Pro -> Premiere Pro
    - Final Cut Pro -> Final Cut Pro
    - DaVinci Resolve -> DaVinci Resolve
    - Photoshop -> Photoshop
    - Illustrator -> Illustrator
    - InDesign -> InDesign
    - Lightroom -> Lightroom
    - Figma -> Figma
    - Sketch -> Sketch
    - Adobe XD -> Adobe XD
    - InVision -> InVision
    - Zeplin -> Zeplin
    - Jira -> Jira
    - Trello -> Trello
    - Asana -> Asana
    - Monday.com -> Monday.com
    - Notion -> Notion
    - Evernote -> Evernote
    - OneNote -> OneNote
    - Slack -> Slack
    - Discord -> Discord
    - Zoom -> Zoom
    - Teams -> Teams
    - Skype -> Skype
    - WebEx -> WebEx
    - GoToMeeting -> GoToMeeting
    - Google Meet -> Google Meet
    - BlueJeans -> BlueJeans
    - Signal -> Signal
    - Telegram -> Telegram
    - WhatsApp -> WhatsApp
    - WeChat -> WeChat
    - Line -> Line
    - KakaoTalk -> KakaoTalk
    - Viber -> Viber
    - Messenger -> Messenger
    - Snapchat -> Snapchat
    - TikTok -> TikTok
    - Douyin -> 抖音
    - Kuaishou -> 快手
    - Bilibili -> Bilibili
    - YouTube -> YouTube
    - Twitch -> Twitch
    - Netflix -> Netflix
    - Disney+ -> Disney+
    - Hulu -> Hulu
    - HBO Max -> HBO Max
    - Amazon Prime Video -> Amazon Prime Video
    - Apple TV+ -> Apple TV+
    - Spotify -> Spotify
    - Apple Music -> Apple Music
    - Amazon Music -> Amazon Music
    - YouTube Music -> YouTube Music
    - Tidal -> Tidal
    - Deezer -> Deezer
    - SoundCloud -> SoundCloud
    - Bandcamp -> Bandcamp
    - Audible -> Audible
    - Kindle -> Kindle
    - Kobo -> Kobo
    - Nook -> Nook
    - Google Play Books -> Google Play Books
    - Apple Books -> Apple Books
    - Steam -> Steam
    - Epic Games Store -> Epic Games Store
    - GOG -> GOG
    - Origin -> Origin
    - Uplay -> Uplay
    - Battle.net -> Battle.net
    - PlayStation -> PlayStation
    - Xbox -> Xbox
    - Nintendo -> Nintendo
    - Switch -> Switch
    - PS5 -> PS5
    - Xbox Series X -> Xbox Series X
    - PC -> PC
    - Mac -> Mac
    - Linux -> Linux
    - iOS -> iOS
    - Android -> Android
    - VR -> VR
    - AR -> AR
    - MR -> MR
    - AI -> AI
    - ML -> ML
    - DL -> DL
    - NLP -> NLP
    - CV -> CV
    - RL -> RL
    - GAN -> GAN
    - GPT -> GPT
    - BERT -> BERT
    - Transformer -> Transformer
    - CNN -> CNN
    - RNN -> RNN
    - LSTM -> LSTM
    - SVM -> SVM
    - KNN -> KNN
    - K-Means -> K-Means
    - PCA -> PCA
    - SVD -> SVD
    - LDA -> LDA
    - Q-Learning -> Q-Learning
    - Deep Q-Network -> Deep Q-Network
    - Policy Gradient -> Policy Gradient
    - Actor-Critic -> Actor-Critic
    - Monte Carlo -> Monte Carlo
    - AlphaGo -> AlphaGo
    - AlphaZero -> AlphaZero
    - OpenAI -> OpenAI
    - DeepMind -> DeepMind
    - Google Brain -> Google Brain
    - Facebook AI Research -> Facebook AI Research
    - Microsoft Research -> Microsoft Research
    - IBM Research -> IBM Research
    - Baidu Research -> Baidu Research
    - Tencent AI Lab -> Tencent AI Lab
    - Alibaba DAMO Academy -> Alibaba DAMO Academy
    - Huawei Noah's Ark Lab -> Huawei Noah's Ark Lab
    - ByteDance AI Lab -> ByteDance AI Lab
    - SenseTime -> SenseTime
    - Megvii -> Megvii
    - CloudWalk -> CloudWalk
    - Yitu -> Yitu
    - iFlytek -> iFlytek
    - Horizon Robotics -> Horizon Robotics
    - Cambricon -> Cambricon
    - DJI -> DJI
    - Ubtech -> Ubtech
    - Segway-Ninebot -> Segway-Ninebot
    - Xiaomi -> Xiaomi
    - Oppo -> Oppo
    - Vivo -> Vivo
    - OnePlus -> OnePlus
    - Realme -> Realme
    - Honor -> Honor
    - Lenovo -> Lenovo
    - ASUS -> ASUS
    - Acer -> Acer
    - MSI -> MSI
    - Gigabyte -> Gigabyte
    - HTC -> HTC
    - Sony -> Sony
    - Panasonic -> Panasonic
    - Sharp -> Sharp
    - Toshiba -> Toshiba
    - Hitachi -> Hitachi
    - Fujitsu -> Fujitsu
    - NEC -> NEC
    - Mitsubishi -> Mitsubishi
    - Canon -> Canon
    - Nikon -> Nikon
    - Olympus -> Olympus
    - Fujifilm -> Fujifilm
    - Ricoh -> Ricoh
    - Pentax -> Pentax
    - Leica -> Leica
    - Hasselblad -> Hasselblad
    - Zeiss -> Zeiss
    - Sigma -> Sigma
    - Tamron -> Tamron
    - Tokina -> Tokina
    - Samyang -> Samyang
    - GoPro -> GoPro
    - Insta360 -> Insta360
    - DJI Osmo -> DJI Osmo
    - Garmin -> Garmin
    - Fitbit -> Fitbit
    - Suunto -> Suunto
    - Polar -> Polar
    - Coros -> Coros
    - Amazfit -> Amazfit
    - Withings -> Withings
    - Oura -> Oura
    - Whoop -> Whoop
    - Peloton -> Peloton
    - Zwift -> Zwift
    - Strava -> Strava
    - Runkeeper -> Runkeeper
    - Nike Run Club -> Nike Run Club
    - Adidas Running -> Adidas Running
    - MyFitnessPal -> MyFitnessPal
    - Lose It! -> Lose It!
    - Noom -> Noom
    - Weight Watchers -> Weight Watchers
    - Headspace -> Headspace
    - Calm -> Calm
    - Insight Timer -> Insight Timer
    - Waking Up -> Waking Up
    - Ten Percent Happier -> Ten Percent Happier
    - BetterHelp -> BetterHelp
    - Talkspace -> Talkspace
    - 7 Cups -> 7 Cups
    - Crisis Text Line -> Crisis Text Line
    - Suicide Prevention Lifeline -> Suicide Prevention Lifeline
    - The Trevor Project -> The Trevor Project
    - RAINN -> RAINN
    - NAMI -> NAMI
    - MHA -> MHA
    - ADAA -> ADAA
    - DBSA -> DBSA
    - IOCDF -> IOCDF
    - PTSD Alliance -> PTSD Alliance
    - Schizophrenia & Psychosis Action Alliance -> Schizophrenia & Psychosis Action Alliance
    - Autism Speaks -> Autism Speaks
    - The Arc -> The Arc
    - Easterseals -> Easterseals
    - United Way -> United Way
    - Red Cross -> Red Cross
    - Salvation Army -> Salvation Army
    - Goodwill -> Goodwill
    - Habitat for Humanity -> Habitat for Humanity
    - Doctors Without Borders -> Doctors Without Borders
    - UNICEF -> UNICEF
    - UNESCO -> UNESCO
    - UNHCR -> UNHCR
    - WFP -> WFP
    - FAO -> FAO
    - ILO -> ILO
    - WHO -> WHO
    - WTO -> WTO
    - IMF -> IMF
    - World Bank -> World Bank
    - OECD -> OECD
    - G7 -> G7
    - G20 -> G20
    - BRICS -> BRICS
    - ASEAN -> ASEAN
    - APEC -> APEC
    - NAFTA -> NAFTA
    - EU -> EU
    - NATO -> NATO
    - UN -> UN

    [OUTPUT FORMAT]
    JSON object with:
    {
      "title": "Traditional Chinese Title",
      "content": "Full Markdown content...",
      "meta_title": "SEO Title",
      "description": "SEO Desc",
      "keywords": "tag1, tag2",
      "tags": ["Translated Tag 1", "Translated Tag 2"]
    }
  `
};

