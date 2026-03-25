/**
 * xvc-worker - YouTube 字幕提取与 AI 内容分析 Worker
 *
 * 主要功能：
 * - /subtitles - 提取 YouTube 视频字幕
 * - /deepseek - 流式返回 DeepSeek AI 分析结果
 * - /analyze - 创建异步分析任务（POST）
 * - /ws/:task_id - WebSocket 连接（GET，升级）
 * - /task/:id - 获取任务状态（GET）
 *
 * 开发命令：
 * - npm run dev - 启动本地开发服务器
 * - npm run deploy - 部署 Worker 到 Cloudflare
 * - npm run test - 运行测试
 * - npm run cf-typegen - 生成 Env 类型定义
 */

import { handleSubtitlesRequest } from './controllers/youtube';
import { handleStreamRequest } from './controllers/stream';
import { handleAnalyzeRequest } from './controllers/analyze';
import { handleTaskStatusRequest } from './controllers/task';
import { handleWebSocketRequest } from './controllers/ws';
import { TaskObject } from './objects/TaskObject';

/**
 * Worker 主入口处理函数
 * 根据请求路径路由到不同的处理器
 */
export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		const url = new URL(request.url);

		// WebSocket 升级请求
		if (url.pathname.startsWith('/ws/')) {
			const taskId = url.pathname.slice(4); // 移除 '/ws/'
			return handleWebSocketRequest(taskId, env);
		}

		// 任务状态查询
		if (url.pathname.startsWith('/task/')) {
			const taskId = url.pathname.slice(6); // 移除 '/task/'
			return handleTaskStatusRequest(taskId, env);
		}

		switch (url.pathname) {
			// YouTube 字幕提取端点
			case '/subtitles':
				return handleSubtitlesRequest(url);
			// DeepSeek AI 分析端点
			case '/deepseek':
				return handleStreamRequest(request, env.DEEPSEEK_API_KEY);
			// 合并端点：字幕提取 + AI 分析（异步任务模式）
			case '/analyze':
				return handleAnalyzeRequest(request, env);
			// 未知路径返回 404
			default:
				return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;

/**
 * 导出 Durable Object 类
 */
export { TaskObject };
