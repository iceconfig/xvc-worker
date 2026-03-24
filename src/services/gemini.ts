import type { LLMStreamOpts, LLMStreamResponse } from '../types/llm';

/**
 * 流式调用 Google Gemini AI API
 * 处理 Gemini 流式响应格式（JSON 数组形式）
 * @param prompt - 发送给 AI 的提示词
 * @param apiKey - Gemini API 密钥
 * @param opts - 可选配置（模型、温度、最大输出 token 数）
 * @returns 异步生成器，逐个返回文本块
 */
export async function* streamGemini(
  prompt: string,
  apiKey: string,
  opts: LLMStreamOpts = {}
): AsyncGenerator<LLMStreamResponse> {
  // 使用默认模型 gemini-2.0-flash
  const model = opts.model ?? 'gemini-2.0-flash';

  // 构建 API 请求 URL
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?key=${apiKey}`;

  // 发送 POST 请求到 Gemini API
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: prompt }]
      }],
      generationConfig: {
        temperature: opts.temperature,
        maxOutputTokens: opts.maxOutputTokens,
      },
    }),
  });

  // 处理 API 错误响应
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${response.statusText} - ${error}`);
  }

  // 获取响应体读取器
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is empty');
  }

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 解码二进制数据
      const chunk = new TextDecoder().decode(value);
      // 分割行并过滤空行
      const lines = chunk.split('\n').filter(line => line.trim() !== '');

      for (const line of lines) {
        // 跳过逗号前缀（Gemini 返回 JSON 数组格式）
        if (line.startsWith(',')) continue;
        let jsonStr = line.trim();
        if (jsonStr.startsWith(',')) {
          jsonStr = jsonStr.slice(1);
        }
        if (!jsonStr) continue;

        try {
          // 解析 JSON 数据
          const data = JSON.parse(jsonStr);
          // 提取文本内容
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
          if (text) {
            yield { text, done: false };
          }
        } catch {
          // 跳过无效的 JSON chunk
        }
      }
    }
  } finally {
    // 释放读取器锁
    reader.releaseLock();
  }

  // 发送结束标记
  yield { text: '', done: true };
}
