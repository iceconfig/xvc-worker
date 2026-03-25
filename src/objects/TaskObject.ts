import { fetchSubtitles } from '../services/youtube';
import { processLongSubtitles } from '../services/deepseek-processor';
import { streamDeepSeek } from '../services/deepseek-client';
import { buildAnalysisPrompt } from '../services/deepseek';
import { estimateTokens } from '../utils/tokenizer';
import { extractVideoId } from '../utils/url';
import { MAX_INPUT_TOKENS } from '../config/constants';
import type { TaskState, WebSocketMessage } from '../types/api';
import type { LLMStreamResponse } from '../types/llm';

/**
 * Durable Object 用于执行长时分析任务
 * 支持 WebSocket 实时推送进度和流式内容
 */
export class TaskObject {
  private state: DurableObjectState;
  private wsConnections: Set<WebSocket> = new Set();
  private currentTask: TaskState | null = null;
  private abortController: AbortController | null = null;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    switch (url.pathname) {
      case '/start':
        return this.startTask(request);
      case '/ws':
        return this.handleWebSocket(request);
      case '/status':
        return this.getStatus();
      case '/cancel':
        return this.cancelTask();
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  /**
   * WebSocket 消息处理（由 DO 运行时调用）
   */
  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    try {
      const data = JSON.parse(message as string);
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch {
      // 忽略无效消息
    }
  }

  /**
   * WebSocket 关闭处理（由 DO 运行时调用）
   */
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean): Promise<void> {
    this.wsConnections.delete(ws);
    console.log(`[TaskObject] WebSocket 关闭 (code: ${code}, reason: ${reason}), 剩余 ${this.wsConnections.size} 个连接`);
  }

  /**
   * 启动分析任务
   */
  private async startTask(request: Request): Promise<Response> {
    const { url, apiKey } = await request.json<{ url: string; apiKey: string }>();

    if (!url || !apiKey) {
      return new Response('Missing url or apiKey', { status: 400 });
    }

    // 获取或初始化任务状态
    let taskState: TaskState | null = null;
    try {
      taskState = await this.state.storage.get<TaskState>('taskState') ?? null;
    } catch {
      taskState = null;
    }

    if (taskState && taskState.status !== 'completed' && taskState.status !== 'failed') {
      // 任务已在运行
      return new Response('Task already running', { status: 409 });
    }

    // 创建新任务状态
    const now = Date.now();
    taskState = {
      id: this.state.id.toString(),
      status: 'pending',
      progress: 0,
      createdAt: now,
      updatedAt: now,
    };

    this.currentTask = taskState;
    this.abortController = new AbortController();

    // 注意：不 await executeTask，让它异步执行
    // DO 会自动保持 event loop 活跃直到所有异步操作完成
    this.executeTask(url, apiKey, taskState).catch((err) => {
      console.error('[TaskObject] 任务执行异常:', err);
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 执行实际的分析任务
   */
  private async executeTask(videoUrl: string, apiKey: string, taskState: TaskState): Promise<void> {
    try {
      // 更新状态为处理中
      taskState.status = 'processing';
      taskState.stage = 'extracting_subtitles';
      taskState.updatedAt = Date.now();
      await this.saveTaskState(taskState);
      this.broadcastProgress({
        progress: 5,
        stage: 'extracting_subtitles',
      });

      // 提取视频 ID
      const videoId = extractVideoId(videoUrl);
      if (!videoId) {
        throw new Error('Invalid YouTube URL. Could not extract video ID.');
      }

      // 获取字幕
      const subtitles = await fetchSubtitles(videoId);
      const subtitleTokens = estimateTokens(subtitles.text);

      console.log(`[TaskObject] 视频 ID: ${videoId}, 字幕条目数：${subtitles.segments.length}, tokens: ${subtitleTokens}`);

      // 根据字幕长度选择处理方式
      const useSegmentedProcessing = subtitleTokens > MAX_INPUT_TOKENS;
      const segments = useSegmentedProcessing
        ? this.calculateSegments(subtitles.segments, subtitleTokens)
        : { total: 1, current: 0 };

      taskState.totalSegments = segments.total;
      taskState.currentSegment = 0;
      await this.saveTaskState(taskState);

      // 创建流式响应处理
      const encoder = new TextEncoder();
      let fullText = '';

      if (useSegmentedProcessing) {
        // 分段处理模式
        console.log(`[TaskObject] 使用分段处理模式，共 ${segments.total} 段`);

        for await (const chunk of processLongSubtitles(subtitles.segments, apiKey)) {
          if (this.abortController?.signal.aborted) {
            console.log('[TaskObject] 任务已取消');
            break;
          }

          if (chunk.text) {
            fullText += chunk.text;
            // 通过 WebSocket 发送内容块
            this.broadcastChunk(chunk.text);
          }

          // 更新进度（分段处理）
          taskState.currentSegment = this.getCurrentSegment(fullText, segments.total);
          taskState.progress = Math.min(95, Math.floor((taskState.currentSegment / segments.total) * 90) + 5);
          taskState.stage = `processing_segment_${taskState.currentSegment}`;
          taskState.updatedAt = Date.now();
          await this.saveTaskState(taskState);
          this.broadcastProgress({
            progress: taskState.progress,
            stage: taskState.stage,
            currentSegment: taskState.currentSegment,
            totalSegments: taskState.totalSegments,
          });
        }
      } else {
        // 直接处理模式
        console.log('[TaskObject] 使用直接处理模式');
        taskState.stage = 'analyzing_content';
        await this.saveTaskState(taskState);

        for await (const chunk of streamDeepSeek(buildAnalysisPrompt(subtitles.text), apiKey)) {
          if (this.abortController?.signal.aborted) {
            console.log('[TaskObject] 任务已取消');
            break;
          }

          if (chunk.text) {
            fullText += chunk.text;
            this.broadcastChunk(chunk.text);
          }

          // 更新进度（直接处理）
          taskState.progress = Math.min(95, Math.floor((fullText.length / 1000) * 90) + 5);
          taskState.updatedAt = Date.now();
          await this.saveTaskState(taskState);
        }
      }

      // 任务完成
      taskState.status = 'completed';
      taskState.progress = 100;
      taskState.stage = 'completed';
      taskState.updatedAt = Date.now();
      await this.saveTaskState(taskState);

      // 保存结果到 storage
      await this.state.storage.put('result', fullText);

      // 发送完成消息
      this.broadcastDone();

      console.log(`[TaskObject] 任务完成，总字数：${fullText.length}`);
    } catch (error) {
      console.error('[TaskObject] 任务执行失败:', error);

      taskState.status = 'failed';
      taskState.error = error instanceof Error ? error.message : 'Unknown error';
      taskState.updatedAt = Date.now();
      await this.saveTaskState(taskState);

      this.broadcastError(taskState.error);
    }
  }

  /**
   * 计算分段信息
   */
  private calculateSegments(segments: any[], totalTokens: number): { total: number; current: number } {
    const targetTokensPerSegment = 8000;
    const total = Math.ceil(totalTokens / targetTokensPerSegment);
    return { total, current: 0 };
  }

  /**
   * 估算当前处理到第几段
   */
  private getCurrentSegment(fullText: string, totalSegments: number): number {
    // 简单估算：根据已生成文本长度比例
    const estimatedProgress = Math.min(1, fullText.length / 5000); // 假设每段约 5000 字
    return Math.max(1, Math.floor(estimatedProgress * totalSegments) + 1);
  }

  /**
   * 处理 WebSocket 连接
   */
  private async handleWebSocket(request: Request): Promise<Response> {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    // 接受服务端 WebSocket
    this.state.acceptWebSocket(server);

    // 存储 server 端 WebSocket 用于发送消息
    this.wsConnections.add(server);

    console.log(`[TaskObject] WebSocket 连接建立，当前 ${this.wsConnections.size} 个连接`);

    // 发送当前状态（如果有任务正在运行）
    const state = await this.getTaskState();
    if (state.status !== 'pending' || this.currentTask) {
      server.send(JSON.stringify({
        type: 'status',
        ...state,
      }));
    }

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  /**
   * 获取任务状态
   */
  private async getStatus(): Promise<Response> {
    const state = await this.getTaskState();

    let result: string | undefined;
    if (state.status === 'completed') {
      try {
        const storedResult = await this.state.storage.get<string>('result');
        result = storedResult ?? undefined;
      } catch {
        result = undefined;
      }
    }

    return new Response(JSON.stringify({ ...state, result }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  /**
   * 取消任务
   */
  private async cancelTask(): Promise<Response> {
    if (this.abortController) {
      this.abortController.abort();
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response('No active task', { status: 400 });
  }

  /**
   * 广播进度消息
   */
  private broadcastProgress(progressData: { progress: number; stage: string; currentSegment?: number; totalSegments?: number }): void {
    const message: WebSocketMessage = {
      type: 'progress',
      taskId: this.currentTask?.id || 'unknown',
      ...progressData,
    };

    const data = JSON.stringify(message);
    const openConnections = Array.from(this.wsConnections).filter(ws => ws.readyState === WebSocket.OPEN);
    console.log(`[TaskObject] broadcastProgress: ${progressData.stage} (${progressData.progress}%), ${openConnections.length} 个连接`);
    openConnections.forEach((ws) => {
      ws.send(data);
    });
  }

  /**
   * 广播内容块
   */
  private broadcastChunk(text: string): void {
    const message: WebSocketMessage = {
      type: 'chunk',
      taskId: this.currentTask?.id || 'unknown',
      text,
    };

    const data = JSON.stringify(message);
    const openConnections = Array.from(this.wsConnections).filter(ws => ws.readyState === WebSocket.OPEN);
    if (openConnections.length > 0) {
      openConnections.forEach((ws) => {
        ws.send(data);
      });
    }
  }

  /**
   * 广播完成消息
   */
  private broadcastDone(): void {
    const message: WebSocketMessage = {
      type: 'done',
      taskId: this.currentTask?.id || 'unknown',
    };

    const data = JSON.stringify(message);
    const openConnections = Array.from(this.wsConnections).filter(ws => ws.readyState === WebSocket.OPEN);
    console.log(`[TaskObject] broadcastDone: ${openConnections.length} 个连接`);
    openConnections.forEach((ws) => {
      ws.send(data);
    });
  }

  /**
   * 广播错误消息
   */
  private broadcastError(message: string): void {
    const wsMessage: WebSocketMessage = {
      type: 'error',
      taskId: this.currentTask?.id || 'unknown',
      message,
    };

    const data = JSON.stringify(wsMessage);
    const openConnections = Array.from(this.wsConnections).filter(ws => ws.readyState === WebSocket.OPEN);
    console.log(`[TaskObject] broadcastError: ${message}, ${openConnections.length} 个连接`);
    openConnections.forEach((ws) => {
      ws.send(data);
    });
  }

  /**
   * 保存任务状态到 storage
   */
  private async saveTaskState(state: TaskState): Promise<void> {
    await this.state.storage.put('taskState', state);
  }

  /**
   * 从 storage 获取任务状态
   */
  private async getTaskState(): Promise<TaskState> {
    const state = await this.state.storage.get<TaskState>('taskState');
    return state || {
      id: this.state.id.toString(),
      status: 'pending',
      progress: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}
