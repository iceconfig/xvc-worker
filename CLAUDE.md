# CLAUDE.md

本文档为 Claude Code (claude.ai/code) 提供在此仓库中工作的指导。

## 项目概述

这是一个 Cloudflare Workers 应用 (`xvc-worker`)，提供 YouTube 视频字幕提取和使用 DeepSeek AI 进行内容分析功能。项目包含 Worker 后端和 React 前端。

## 开发命令

### 根项目 (Worker)
- `npm run dev` - 启动本地开发服务器 (http://localhost:8787)
- `npm run deploy` - 部署 Worker 到 Cloudflare
- `npm run test` - 运行 Vitest 测试
- `npm run cf-typegen` - 生成 Env 绑定的类型定义

### Web 项目 (前端)
- `npm run dev` - 启动 Vite 开发服务器 (web/)
- `npm run build` - 构建 React 应用到 `public/` 目录
- `npm run preview` - 预览生产构建

## 架构

这是一个 monorepo 项目，包含两部分：

**根目录 (`/`)** - Cloudflare Worker 后端
- `src/index.ts` - Worker 入口，处理请求路由
- `src/objects/TaskObject.ts` - Durable Object，执行异步分析任务
- `src/controllers/` - 请求处理器
  - `youtube.ts` - YouTube 字幕端点 (`/subtitles`)
  - `analyze.ts` - 分析任务创建端点 (`POST /analyze`)
  - `task.ts` - 任务状态查询端点 (`GET /task/:id`)
  - `ws.ts` - WebSocket 升级端点 (`GET /ws/:id`)
- `src/services/` - 外部 API 集成
  - `youtube.ts` - 从外部服务获取字幕
  - `deepseek.ts` - DeepSeek AI 服务导出
  - `deepseek-client.ts` - DeepSeek API 客户端
  - `deepseek-processor.ts` - 长字幕分段处理器
- `src/types/` - TypeScript 类型定义
- `src/utils/` - 工具函数
- `src/prompts/` - 系统提示词模板
- `src/config/` - 常量配置

**Web (`/web/`)** - React 前端，使用 Vite 构建
- 构建到 `public/` 目录，由 Worker 通过 `wrangler.jsonc` assets 配置提供服务

## API 端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/subtitles` | GET | 提取 YouTube 视频字幕，返回 JSON |
| `/deepseek` | POST | 流式返回 AI 分析结果 |
| `/analyze` | POST | 创建异步分析任务，返回 task_id 和 WebSocket URL |
| `/ws/:id` | WebSocket | WebSocket 连接，实时推送任务进度和内容 |
| `/task/:id` | GET | 轮询方式获取任务状态 |

## 环境变量

在 `wrangler.jsonc` 中配置或通过 Cloudflare 控制台设置：
- `DEEPSEEK_API_KEY` - `/deepseek` 和 `/analyze` 端点必需

### Durable Objects 和 KV 绑定

```json
{
  "durable_objects": {
    "bindings": [
      { "name": "TASK_OBJECT", "class_name": "TaskObject" }
    ]
  },
  "kv_namespaces": [
    { "binding": "TASK_KV", "id": "<your-kv-namespace-id>" }
  ]
}
```

## 测试

使用 `@cloudflare/vitest-pool-workers` 进行测试。

**测试模式:**
- 单元测试风格：`worker.fetch(request, env, ctx)` 配合 `createExecutionContext()`
- 集成测试风格：`SELF.fetch(request)` 端到端测试

**运行单个测试:**
```bash
npm run test -- -t "测试名称"
```

## 类型安全

在 `wrangler.jsonc` 中添加绑定后，运行 `npm run cf-typegen` 重新生成 `worker-configuration.d.ts` 中的 `Env` 类型。

## 代码规范

- 所有代码使用 TypeScript
- 遵循 ESLint 配置
- 函数和类型使用英文命名
- 注释和文档使用中文

## 常见问题

### Durable Objects 使用

```typescript
// 获取 Durable Object Stub
const taskStub = env.TASK_OBJECT.get(env.TASK_OBJECT.idFromName(taskId));

// 调用 DO 方法
const response = await taskStub.fetch(new Request('http://internal/start', {
  method: 'POST',
  body: JSON.stringify({ url, apiKey }),
}));
```

### WebSocket 消息格式

```typescript
// 进度消息
{ type: 'progress', progress: 45, stage: 'processing_segment_3' }

// 内容块
{ type: 'chunk', text: '生成的文本内容' }

// 完成消息
{ type: 'done' }

// 错误消息
{ type: 'error', message: '错误描述' }
```
