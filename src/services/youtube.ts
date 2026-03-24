/**
 * 字幕条目接口
 * 表示字幕中的一条记录
 */
export interface SubtitleEntry {
  start: number;      // 开始时间（秒）
  duration: number;   // 持续时间（秒）
  text: string;       // 字幕文本
}

/**
 * 字幕响应接口
 * 外部字幕 API 返回的数据结构
 */
export interface SubtitleResponse {
  videoId: string;            // 视频 ID
  language: string;           // 字幕语言
  subtitles: SubtitleEntry[]; // 字幕条目列表
}

/**
 * 从外部服务获取 YouTube 视频字幕
 * 通过 ngrok 隧道访问字幕提取服务
 * @param videoId - YouTube 视频 ID
 * @returns 包含字幕数据的响应对象
 * @throws 当 API 请求失败时抛出错误
 */
export async function fetchSubtitles(videoId: string): Promise<SubtitleResponse> {
  const response = await fetch(
    `https://swingeing-infrequent-venus.ngrok-free.dev/subtitles?videoId=${encodeURIComponent(videoId)}`,
    {
      headers: {
        // ngrok 免费隧道所需的安全头
        'ngrok-skip-browser-warning': 'true',
      },
    }
  );

  // 检查响应状态
  if (!response.ok) {
    throw new Error(`Failed to fetch subtitles: ${response.status} ${response.statusText}`);
  }

  return response.json<SubtitleResponse>();
}
