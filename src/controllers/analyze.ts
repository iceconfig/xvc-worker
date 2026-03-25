import { extractVideoId } from '../utils/url';
import type { CreateTaskResponse } from '../types/api';

/**
 * 处理分析任务创建请求
 * 1. 验证 url 参数是否存在
 * 2. 生成任务 ID
 * 3. 通过 Durable Object 执行异步任务
 * 4. 立即返回任务 ID 和 WebSocket URL
 * @param request - HTTP 请求对象
 * @param env - 环境变量绑定
 * @returns 任务创建响应（包含 task_id 和 ws_url）
 */
export async function handleAnalyzeRequest(request: Request, env: Env): Promise<Response> {
  // 验证请求方法
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // 验证 API Key 是否配置
  if (!env.DEEPSEEK_API_KEY) {
    return new Response('API_KEY not configured', { status: 500 });
  }

  // 解析请求体
  let body: { url?: string };
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const videoUrl = body.url;

  // 缺少 url 参数
  if (!videoUrl) {
    return new Response(
      JSON.stringify({ error: 'Missing "url" in request body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 提取视频 ID（预验证）
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return new Response(
      JSON.stringify({ error: 'Invalid YouTube URL. Could not extract video ID.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 生成任务 ID（使用唯一 ID）
  const taskId = crypto.randomUUID();

  // 获取 Durable Object Stub
  const taskStub = env.TASK_OBJECT.get(env.TASK_OBJECT.idFromName(taskId));

  // 启动任务（异步执行）
  const startResponse = await taskStub.fetch(new Request('http://internal/start', {
    method: 'POST',
    body: JSON.stringify({
      url: videoUrl,
      apiKey: env.DEEPSEEK_API_KEY,
    }),
    headers: { 'Content-Type': 'application/json' },
  }));

  if (!startResponse.ok) {
    const errorText = await startResponse.text();
    return new Response(
      JSON.stringify({ error: `Failed to start task: ${errorText}` }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 构建 WebSocket URL（基于当前请求 URL）
  const requestUrl = new URL(request.url);
  const wsProtocol = requestUrl.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${wsProtocol}//${requestUrl.host}/ws/${taskId}`;
  const statusUrl = `${requestUrl.origin}/task/${taskId}`;

  // 返回 202 Accepted
  const responseBody: CreateTaskResponse = {
    task_id: taskId,
    ws_url: wsUrl,
    status_url: statusUrl,
  };

  return new Response(JSON.stringify(responseBody), {
    status: 202,
    headers: { 'Content-Type': 'application/json' },
  });
}
