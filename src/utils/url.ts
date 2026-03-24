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
