import { fetchSubtitles } from '../services/youtube';

/**
 * YouTube URL 正则表达式模式列表
 * 按优先级匹配以下格式：
 * 1. youtube.com/watch?v=VIDEO_ID - 标准观看链接
 * 2. youtu.be/VIDEO_ID - 短链接
 * 3. youtube.com/embed/VIDEO_ID - 嵌入链接
 * 4. youtube.com/v/VIDEO_ID - 旧版链接
 */
const YOUTUBE_PATTERNS = [
  // https://www.youtube.com/watch?v=VIDEO_ID
  /^https?:\/\/(?:www\.)?youtube\.com\/watch\?v=([^&]+)/,
  // https://youtu.be/VIDEO_ID
  /^https?:\/\/(?:www\.)?youtu\.be\/([^?/]+)/,
  // https://www.youtube.com/embed/VIDEO_ID
  /^https?:\/\/(?:www\.)?youtube\.com\/embed\/([^?/]+)/,
  // https://www.youtube.com/v/VIDEO_ID
  /^https?:\/\/(?:www\.)?youtube\.com\/v\/([^?/]+)/,
];

/**
 * 从 YouTube URL 中提取视频 ID
 * @param url - YouTube 视频链接
 * @returns 视频 ID，如果 URL 无效则返回 null
 */
export function extractVideoId(url: string): string | null {
  for (const pattern of YOUTUBE_PATTERNS) {
    const match = url.match(pattern);
    if (match) {
      return match[1];
    }
  }
  return null;
}

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
