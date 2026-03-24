/**
 * xvc-worker - YouTube 字幕提取与 AI 内容分析 Worker
 *
 * 主要功能：
 * - /subtitles - 提取 YouTube 视频字幕
 * - /deepseek - 流式返回 DeepSeek AI 分析结果
 *
 * 开发命令：
 * - npm run dev - 启动本地开发服务器
 * - npm run deploy - 部署 Worker 到 Cloudflare
 * - npm run test - 运行测试
 * - npm run cf-typegen - 生成 Env 类型定义
 */

import { handleSubtitlesRequest } from './controllers/youtube';
import { handleStreamRequest } from './controllers/stream';

/**
 * Worker 主入口处理函数
 * 根据请求路径路由到不同的处理器
 */
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const url = new URL(request.url);
		switch (url.pathname) {
			// YouTube 字幕提取端点
			case '/subtitles':
				return handleSubtitlesRequest(url);
			// DeepSeek AI 分析端点
			case '/deepseek':
				return handleStreamRequest(request, env.DEEPSEEK_API_KEY);
			// 未知路径返回 404
			default:
				return new Response('Not Found', { status: 404 });
		}
	},
} satisfies ExportedHandler<Env>;
