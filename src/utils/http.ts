/**
 * HTTP 响应工具
 */

/**
 * 创建 JSON 响应
 * @param data - 响应数据
 * @param status - HTTP 状态码
 */
export function jsonResponse<T>(data: T, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * 创建错误响应
 * @param message - 错误消息
 * @param status - HTTP 状态码
 */
export function errorResponse(message: string, status: number = 500): Response {
  return jsonResponse({ error: message }, status);
}

/**
 * 创建文本响应
 * @param text - 响应文本
 * @param status - HTTP 状态码
 */
export function textResponse(text: string, status: number = 200): Response {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
