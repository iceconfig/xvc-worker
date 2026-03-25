# XVC Worker

基于 Cloudflare Workers 的 YouTube 视频字幕提取与 AI 内容分析应用，使用 DeepSeek AI 生成深度分析内容。

## 功能特性

- 🎬 从任意 YouTube 视频提取字幕
- 🤖 使用 DeepSeek AI 进行智能内容分析
- ⚡ 基于 Cloudflare Workers 的无服务器架构
- 🖥️ 简洁的 React 前端界面
- 📡 流式响应，实时输出分析内容
- 🔄 支持异步任务处理，适合长视频分析

## 项目结构

```
xvc-worker/
├── src/
│   ├── index.ts              # Worker 入口和路由
│   ├── objects/
│   │   └── TaskObject.ts     # Durable Object（异步任务执行）
│   ├── controllers/
│   │   ├── youtube.ts        # YouTube 字幕请求处理
│   │   ├── analyze.ts        # 分析任务创建处理
│   │   ├── task.ts           # 任务状态查询处理
│   │   └── ws.ts             # WebSocket 升级处理
│   ├── services/
│   │   ├── youtube.ts        # YouTube 字幕获取服务
│   │   ├── deepseek.ts       # DeepSeek API 集成
│   │   ├── deepseek-client.ts # DeepSeek 客户端
│   │   └── deepseek-processor.ts # 长字幕分段处理器
│   ├── types/
│   │   ├── api.ts            # API 类型定义
│   │   └── llm.ts            # LLM 类型定义
│   ├── utils/
│   │   ├── url.ts            # URL 工具
│   │   ├── tokenizer.ts      # Token 估算工具
│   │   └── prompts.ts        # 提示词构建工具
│   ├── prompts/
│   │   └── system-prompts.ts # 系统提示词模板
│   └── config/
│       └── constants.ts      # 常量配置
├── web/                      # React 前端 (Vite)
│   ├── src/
│   │   ├── App.tsx           # 主应用组件
│   │   └── main.tsx          # React 入口
│   └── index.html
├── test/                     # Vitest 测试文件
├── wrangler.jsonc            # Worker 配置
└── package.json
```

## 快速开始

### 前置要求

- Node.js 18+
- npm
- Cloudflare 账号（用于部署）
- DeepSeek API 密钥

### 安装

```bash
# 安装根目录依赖
npm install

# 安装前端依赖
cd web && npm install
```

### 开发

1. **启动 Worker 开发服务器:**
   ```bash
   npm run dev
   ```
   服务地址：http://localhost:8787

2. **构建前端:**
   ```bash
   cd web
   npm run build
   ```
   前端构建到 `public/` 目录，由 Worker 自动提供服务。

### 环境变量

在根目录创建 `.dev.vars` 文件：

```
DEEPSEEK_API_KEY=your_deepseek_api_key
```

生产环境通过 Wrangler CLI 配置：

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

## API 端点

### POST /analyze

创建异步分析任务，返回任务 ID 和 WebSocket 连接地址。

**请求体:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**示例:**
```bash
curl -X POST http://localhost:8787/analyze \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.youtube.com/watch?v=VIDEO_ID"}'
```

**响应:**
```json
{
  "task_id": "uuid-here",
  "ws_url": "ws://localhost:8787/ws/uuid-here",
  "status_url": "http://localhost:8787/task/uuid-here"
}
```

### GET /ws/:task_id

WebSocket 连接端点，用于实时接收任务进度和分析内容。

**消息类型:**
- `progress` - 进度更新 `{progress: number, stage: string}`
- `chunk` - 内容块 `{text: string}`
- `done` - 任务完成
- `error` - 错误消息 `{message: string}`

### GET /task/:id

轮询方式获取任务状态。

**响应:**
```json
{
  "id": "uuid-here",
  "status": "processing",
  "progress": 45,
  "stage": "processing_segment_3",
  "currentSegment": 3,
  "totalSegments": 10
}
```

### GET /subtitles

提取 YouTube 视频字幕（独立端点）。

**查询参数:**
- `url` (必需): YouTube 视频地址

**示例:**
```bash
curl "http://localhost:8787/subtitles?url=https://www.youtube.com/watch?v=VIDEO_ID"
```

**响应:**
```json
{
  "videoId": "VIDEO_ID",
  "language": "en",
  "segments": [...]
}
```

### POST /deepseek

流式返回 AI 分析结果。

**请求体:**
```json
{
  "prompt": "你的字幕文本或分析提示词"
}
```

## 架构设计

### 异步任务处理流程

```
客户端 → POST /analyze → Worker → 创建任务 ID → 返回 202 Accepted
                                    ↓
                              Durable Object
                                    ↓
                              执行分析任务
                                    ↓
                              WebSocket 推送进度
                                    ↓
                              保存到 Storage
```

### 任务状态流转

```
pending → processing → completed
                 ↘
                  failed
```

## 部署

```bash
# 1. 构建前端
cd web && npm run build

# 2. 创建 KV 命名空间（首次部署）
npx wrangler kv:namespace create "TASK_KV"

# 3. 部署到 Cloudflare Workers
npm run deploy
```

## 测试

```bash
# 运行所有测试
npm run test

# 运行特定测试
npm run test -- -t "测试名称"
```

## 技术栈

- **运行环境:** Cloudflare Workers
- **前端:** React 19, Vite
- **语言:** TypeScript
- **测试:** Vitest (@cloudflare/vitest-pool-workers)
- **AI:** DeepSeek API
- **状态管理:** Durable Objects + KV 存储

## 注意事项

### Durable Objects 限制

- 单次任务最长运行时间：**1 小时**
- 适合处理 30-60 分钟的视频
- 超时视频需要额外的超时处理和重试机制

### KV 命名空间

部署后需要在 `wrangler.jsonc` 中更新实际的 KV namespace ID。

## License

MIT
