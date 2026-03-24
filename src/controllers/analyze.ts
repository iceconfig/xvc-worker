import { fetchSubtitles } from '../services/youtube';
import { buildAnalysisPrompt, streamDeepSeek, processLongSubtitles } from '../services/deepseek';
import { estimateTokens } from '../utils/tokenizer';
import { extractVideoId } from '../utils/url';
import { MAX_INPUT_TOKENS } from '../config/constants';

/**
 * 处理 YouTube 字幕提取与 AI 分析的合并请求
 * 1. 验证 url 参数是否存在
 * 2. 提取视频 ID
 * 3. 调用服务获取字幕
 * 4. 将字幕传入 DeepSeek 进行流式分析
 * 5. 返回流式响应
 * @param request - HTTP 请求对象
 * @param apiKey - DeepSeek API 密钥
 * @returns 流式响应或错误信息
 */
export async function handleAnalyzeRequest(request: Request, apiKey: string): Promise<Response> {
  // 验证请求方法
  if (request.method !== 'GET') {
    return new Response('Method not allowed', { status: 405 });
  }

  // 验证 API Key 是否配置
  if (!apiKey) {
    return new Response('API_KEY not configured', { status: 500 });
  }

  const url = new URL(request.url);
  const videoUrl = url.searchParams.get('url');

  // 缺少 url 参数
  if (!videoUrl) {
    return new Response(
      JSON.stringify({ error: 'Missing "url" query parameter' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 提取视频 ID
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return new Response(
      JSON.stringify({ error: 'Invalid YouTube URL. Could not extract video ID.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // 获取字幕
  try {
    const subtitles = await fetchSubtitles(videoId);

    // 估算字幕 token 数量
    const subtitleTokens = estimateTokens(subtitles.text);

    // 根据字幕长度选择处理方式
    const useSegmentedProcessing = subtitleTokens > MAX_INPUT_TOKENS;

    // 输出调试日志
    console.log(`[analyze] 视频 ID: ${videoId}`);
    console.log(`[analyze] 字幕条目数：${subtitles.segments.length}`);
    console.log(`[analyze] 估算 token 数：${subtitleTokens}`);
    console.log(`[analyze] 处理模式：${useSegmentedProcessing ? '分段处理' : '直接处理'}`);

    // 创建流式响应
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        const decoder = new TextDecoder();
        let totalBytes = 0;
        let chunkCount = 0;
        let fullText = '';
        try {
          if (useSegmentedProcessing) {
            // 分段处理模式：字幕过长，需要分段摘要后整合
            for await (const chunk of processLongSubtitles(subtitles.segments, apiKey)) {
              if (chunk.text) {
                const bytes = encoder.encode(chunk.text);
                totalBytes += bytes.length;
                chunkCount++;
                fullText += chunk.text;
                controller.enqueue(bytes);
              }
              if (chunk.done) {
                const last20Chars = fullText.slice(-20);
                console.log(`[analyze] 分段处理完成，共输出 ${chunkCount} 个 chunks, 总计 ${totalBytes} bytes`);
                console.log(`[analyze] 最终稿件最后 20 字：${last20Chars}`);
                controller.close();
              }
            }
          } else {
            // 直接处理模式：字幕在限制内，直接发送完整内容
            for await (const chunk of streamDeepSeek(buildAnalysisPrompt(subtitles.text), apiKey)) {
              if (chunk.text) {
                const bytes = encoder.encode(chunk.text);
                totalBytes += bytes.length;
                chunkCount++;
                fullText += chunk.text;
                console.log(`[analyze] 输出 chunk #${chunkCount}: ${bytes.length} bytes, 累计 ${totalBytes} bytes`);
                controller.enqueue(bytes);
              }
              if (chunk.done) {
                const last20Chars = fullText.slice(-20);
                console.log(`[analyze] 直接处理完成，共输出 ${chunkCount} 个 chunks, 总计 ${totalBytes} bytes`);
                console.log(`[analyze] 最终稿件最后 20 字：${last20Chars}`);
                controller.close();
              }
            }
          }
        } catch (error) {
          // 流处理错误
          console.error('[analyze] 流处理错误:', error);
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
