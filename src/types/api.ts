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
