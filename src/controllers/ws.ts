/**
 * 处理 WebSocket 升级请求
 * GET /ws/:task_id
 * @param taskId - 任务 ID
 * @param env - 环境变量绑定
 * @returns WebSocket 升级响应
 */
export async function handleWebSocketRequest(taskId: string, env: Env): Promise<Response> {
  if (!taskId) {
    return new Response(
      JSON.stringify({ error: 'Missing task ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 获取 Durable Object Stub
    const taskStub = env.TASK_OBJECT.get(env.TASK_OBJECT.idFromName(taskId));

    // 请求 WebSocket 升级
    const response = await taskStub.fetch(new Request('http://internal/ws', {
      headers: {
        Upgrade: 'websocket',
      },
    }));

    // 检查是否是 WebSocket 升级响应
    if (response.status !== 101) {
      return new Response(
        JSON.stringify({ error: 'Failed to upgrade WebSocket' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return response;
  } catch (error) {
    console.error('[handleWebSocketRequest] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
