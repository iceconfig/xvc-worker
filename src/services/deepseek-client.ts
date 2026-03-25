import type { LLMStreamOpts, LLMStreamResponse } from '../types/llm';
import { ANALYSIS_SYSTEM_INSTRUCTION } from '../prompts/system-prompts';

/**
 * 流式调用 DeepSeek AI API
 * 处理 SSE（Server-Sent Events）格式的流式响应
 * @param prompt - 发送给 AI 的提示词
 * @param apiKey - DeepSeek API 密钥
 * @param opts - 可选配置（模型、温度、最大输出 token 数）
 * @returns 异步生成器，逐个返回文本块
 */
export async function* streamDeepSeek(
  prompt: string,
  apiKey: string,
  opts: LLMStreamOpts = {}
): AsyncGenerator<LLMStreamResponse> {
  // 使用默认模型 deepseek-chat
  const model = opts.model ?? 'deepseek-chat';

  const url = 'https://api.deepseek.com/v1/chat/completions';

  // 发送 POST 请求到 DeepSeek API
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      stream: true, // 启用流式模式
      temperature: opts.temperature,
      max_tokens: opts.maxOutputTokens,
    }),
  });

  // 处理 API 错误响应
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${error}`);
  }

  // 获取响应体读取器
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is empty');
  }

  const decoder = new TextDecoder();
  let buffer = ''; // 缓冲区，用于处理跨 chunk 的数据

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      // 解码二进制数据并添加到缓冲区
      buffer += decoder.decode(value, { stream: true });
      // 按行分割
      const lines = buffer.split('\n');
      // 保留最后一行（可能是不完整的行）
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        // 跳过空行和非 data: 行
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        // 移除 'data:' 前缀
        const dataStr = trimmed.slice(5).trim();
        // 遇到 [DONE] 标记，结束流
        if (dataStr === '[DONE]') {
          break;
        }

        try {
          // 解析 JSON 数据
          const data = JSON.parse(dataStr);
          // 提取文本内容
          const text = data.choices?.[0]?.delta?.content ?? '';
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

/**
 * 流式调用 DeepSeek AI API 并返回完整响应
 * 与 streamDeepSeek 类似，使用 ANALYSIS_SYSTEM_INSTRUCTION 指令
 * @param prompt - 发送给 AI 的提示词
 * @param apiKey - DeepSeek API 密钥
 * @param opts - 可选配置
 * @returns 异步生成器，逐个返回文本块
 */
export async function* streamDeepSeekWithResponse(
  prompt: string,
  apiKey: string,
  opts: LLMStreamOpts = {}
): AsyncGenerator<LLMStreamResponse> {
  const model = opts.model ?? 'deepseek-chat';
  const url = 'https://api.deepseek.com/v1/chat/completions';

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: model,
      messages: [
        { role: 'system', content: ANALYSIS_SYSTEM_INSTRUCTION },
        { role: 'user', content: prompt },
      ],
      stream: true,
      temperature: opts.temperature,
      max_tokens: opts.maxOutputTokens,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DeepSeek API error: ${response.status} ${response.statusText} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('Response body is empty');
  }

  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data:')) continue;

        const dataStr = trimmed.slice(5).trim();
        if (dataStr === '[DONE]') {
          break;
        }

        try {
          const data = JSON.parse(dataStr);
          const text = data.choices?.[0]?.delta?.content ?? '';
          if (text) {
            yield { text, done: false };
          }
        } catch {
          // 跳过无效的 JSON chunk
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
