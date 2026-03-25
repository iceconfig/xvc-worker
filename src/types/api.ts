/**
 * API 错误类型
 */
export enum ErrorCode {
  BAD_REQUEST = 400,
  UNAUTHORIZED = 401,
  FORBIDDEN = 403,
  NOT_FOUND = 404,
  METHOD_NOT_ALLOWED = 405,
  INTERNAL_ERROR = 500,
  SERVICE_UNAVAILABLE = 503,
}

/**
 * 统一错误响应格式
 */
export interface ErrorResponse {
  error: string;
  code?: ErrorCode;
}

/**
 * API 错误类
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public code: ErrorCode = ErrorCode.INTERNAL_ERROR
  ) {
    super(message);
    this.name = 'ApiError';
  }

  toResponse(): Response {
    return new Response(
      JSON.stringify({ error: this.message, code: this.code }),
      {
        status: this.code,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

/**
 * 任务状态
 */
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

/**
 * 任务状态数据
 */
export interface TaskState {
  id: string;
  status: TaskStatus;
  progress: number;              // 0-100
  currentSegment?: number;       // 当前处理的段序号
  totalSegments?: number;        // 总段数
  stage?: string;                // 当前阶段描述
  createdAt: number;             // 创建时间戳
  updatedAt: number;             // 更新时间戳
  error?: string;                // 错误信息（失败时）
}

/**
 * 任务进度消息（通过 WebSocket 推送）
 */
export interface TaskProgressMessage {
  type: 'progress';
  taskId: string;
  progress: number;
  stage: string;
  currentSegment?: number;
  totalSegments?: number;
}

/**
 * 流式内容块（通过 WebSocket 推送）
 */
export interface TaskChunkMessage {
  type: 'chunk';
  taskId: string;
  text: string;
}

/**
 * 任务完成消息（通过 WebSocket 推送）
 */
export interface TaskDoneMessage {
  type: 'done';
  taskId: string;
}

/**
 * 任务错误消息（通过 WebSocket 推送）
 */
export interface TaskErrorMessage {
  type: 'error';
  taskId: string;
  message: string;
}

/**
 * WebSocket 消息类型
 */
export type WebSocketMessage = TaskProgressMessage | TaskChunkMessage | TaskDoneMessage | TaskErrorMessage;

/**
 * 创建任务请求体
 */
export interface CreateTaskRequest {
  url: string;
}

/**
 * 创建任务响应体
 */
export interface CreateTaskResponse {
  task_id: string;
  ws_url: string;
  status_url: string;
}

/**
 * 获取任务状态响应体
 */
export interface GetTaskStatusResponse {
  id: string;
  status: TaskStatus;
  progress: number;
  stage?: string;
  currentSegment?: number;
  totalSegments?: number;
  error?: string;
  result?: string;  // 完成后返回的分析结果
}
