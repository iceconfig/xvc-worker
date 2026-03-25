import type { GetTaskStatusResponse } from '../types/api';

/**
 * 处理任务状态查询请求
 * GET /task/:id
 * @param taskId - 任务 ID
 * @param env - 环境变量绑定
 * @returns 任务状态响应
 */
export async function handleTaskStatusRequest(taskId: string, env: Env): Promise<Response> {
  if (!taskId) {
    return new Response(
      JSON.stringify({ error: 'Missing task ID' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    // 获取 Durable Object Stub
    const taskStub = env.TASK_OBJECT.get(env.TASK_OBJECT.idFromName(taskId));

    // 请求任务状态
    const response = await taskStub.fetch(new Request('http://internal/status'));

    if (!response.ok) {
      if (response.status === 404) {
        return new Response(
          JSON.stringify({ error: 'Task not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Failed to get task status' }),
        { status: response.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json() as GetTaskStatusResponse;
    const taskData: GetTaskStatusResponse = {
      id: taskId,
      status: data.status,
      progress: data.progress,
      stage: data.stage,
      currentSegment: data.currentSegment,
      totalSegments: data.totalSegments,
      error: data.error,
      result: data.result,
    };

    return new Response(JSON.stringify(taskData), {
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[handleTaskStatusRequest] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
