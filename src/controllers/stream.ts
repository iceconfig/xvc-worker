import { buildAnalysisPrompt, streamDeepSeek } from '../services/deepseek';
import type { LLMStreamResponse } from '../types/llm';

/**
 * 处理 DeepSeek 流式分析请求
 * 1. 验证请求方法为 POST
 * 2. 解析并验证 prompt 参数
 * 3. 验证 API Key 是否配置
 * 4. 创建流式响应
 * @param request - HTTP 请求对象
 * @param apiKey - DeepSeek API 密钥
 * @returns 流式响应或错误响应
 */
export async function handleStreamRequest(request: Request, apiKey: string): Promise<Response> {
  // 验证请求方法
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // 解析请求体
  const { prompt } = await request.json<{ prompt: string }>();
  // 验证 prompt 是否存在
  if (!prompt) {
    return new Response('Missing prompt', { status: 400 });
  }

  // 验证 API Key 是否配置
  if (!apiKey) {
    return new Response('API_KEY not configured', { status: 500 });
  }

  // 创建流式响应
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        // 迭代处理 DeepSeek 流式响应
        for await (const chunk of streamDeepSeek(buildAnalysisPrompt(prompt), apiKey)) {
          if (chunk.text) {
            // 将文本块编码并推送到流
            controller.enqueue(encoder.encode(chunk.text));
          }
          if (chunk.done) {
            // 流结束，关闭控制器
            controller.close();
          }
        }
      } catch (error) {
        // 流处理错误
        controller.error(error);
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  });
};
