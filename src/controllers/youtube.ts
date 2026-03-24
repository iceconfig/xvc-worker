import { fetchSubtitles } from '../services/youtube';
import { extractVideoId } from '../utils/url';

/**
 * 处理 YouTube 字幕提取请求
 * 1. 验证 url 参数是否存在
 * 2. 提取视频 ID
 * 3. 调用服务获取字幕
 * 4. 返回 JSON 响应
 * @param url - 请求的 URL 对象
 * @returns 字幕 JSON 或错误信息
 */
export async function handleSubtitlesRequest(url: URL): Promise<Response> {
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

  // 获取字幕并返回
  try {
    const subtitles = await fetchSubtitles(videoId);
    return new Response(
      JSON.stringify(subtitles),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
