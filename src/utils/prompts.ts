import type { SubtitleEntry } from '../services/youtube';
import { estimateTokens } from './tokenizer';

/**
 * 将字幕分割成多个段
 * 按时间顺序和 token 限制进行分割，尽量在句子边界处切分
 * @param subtitles - 完整字幕列表
 * @param targetTokensPerSegment - 每段目标 token 数
 * @param overlapEntries - 每段与前一段的重叠条目数（默认 0，即不重叠）
 * @returns 分割后的字幕段列表
 */
export function splitSubtitles(
  subtitles: SubtitleEntry[],
  targetTokensPerSegment: number = 20000,
  overlapEntries: number = 0
): SubtitleEntry[][] {
  const segments: SubtitleEntry[][] = [];
  let currentSegment: SubtitleEntry[] = [];
  let currentTokens = 0;

  for (let i = 0; i < subtitles.length; i++) {
    const entry = subtitles[i];
    const entryTokens = estimateTokens(entry.text);

    // 如果当前段已满，开始新段
    if (currentTokens + entryTokens > targetTokensPerSegment && currentSegment.length > 0) {
      segments.push(currentSegment);

      // 如果有重叠配置，从当前段的末尾回溯重叠条目
      if (overlapEntries > 0 && currentSegment.length > overlapEntries) {
        // 重叠部分：当前段末尾的 overlapEntries 条字幕
        const overlapStartIndex = currentSegment.length - overlapEntries;
        currentSegment = currentSegment.slice(overlapStartIndex);
        currentTokens = currentSegment.reduce((sum, e) => sum + estimateTokens(e.text), 0);
      } else {
        currentSegment = [];
        currentTokens = 0;
      }
    }

    currentSegment.push(entry);
    currentTokens += entryTokens;
  }

  // 添加最后一个段
  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
}

/**
 * 为分段生成带重叠上下文的稿件提示词
 * 明确标识重叠部分和上一段输出，指导 AI 自然衔接前文并避免重复
 * @param currentSegment - 当前段字幕
 * @param overlapSegment - 重叠部分（前一段的末尾），第一段为 null
 * @param previousOutput - 上一段的稿件输出，第一段为 null
 * @param segmentIndex - 段索引（从 0 开始）
 * @param totalSegments - 总段数
 * @returns 稿件提示词
 */
export function buildSegmentDraftPromptWithOverlap(
  currentSegment: SubtitleEntry[],
  overlapSegment: SubtitleEntry[] | null,
  previousOutput: string | null,
  segmentIndex: number,
  totalSegments: number
): string {
  const currentText = currentSegment.map((e) => e.text).join(' ');

  if (!overlapSegment || segmentIndex === 0) {
    // 第一段，没有重叠部分
    return `这是视频字幕的第 ${segmentIndex + 1}/${totalSegments} 部分。请根据以下字幕内容，整理成简洁的对话稿件片段。

要求：
- 只保留核心观点，大幅精简冗余内容
- 输出篇幅控制在原文的 30% 以内
- 仅保留关键数据和技术术语
- 避免逐字翻译，用简洁语言复述
- 输出使用中文

字幕内容：
${currentText}`;
  }

  // 有重叠部分，明确标识
  const overlapText = overlapSegment.map((e) => e.text).join(' ');

  // 构建提示词，包含上一段输出作为参考
  const parts: string[] = [
    `这是视频字幕的第 ${segmentIndex + 1}/${totalSegments} 部分。请根据以下字幕内容，整理成简洁的对话稿件片段。`,
  ];

  if (previousOutput) {
    parts.push(`
【上一段输出】以下是上一部分的稿件内容（你已经输出过的内容，不要重复）：
${previousOutput}
`);
  }

  if (overlapText) {
    parts.push(`
【前文参考】以下是上一部分的末尾字幕，供你参考上下文（不需要处理这部分）：
${overlapText}
`);
  }

  parts.push(`
【当前内容】请根据以下字幕内容，整理成简洁的对话稿件片段：
${currentText}

要求：
- 只保留核心观点，大幅精简冗余内容
- 输出篇幅控制在原文的 30% 以内
- 注意与上一段输出的自然衔接，保持风格一致
- 不要重复上一段已经输出过的内容
- 仅保留关键数据和技术术语
- 避免逐字翻译，用简洁语言复述
- 输出使用中文`);

  return parts.join('');
}

/**
 * 构建 AI 分析提示词
 * 将字幕内容格式化为结构化分析指令，指导 AI 生成分析文章
 * @param captions - 视频字幕原文
 * @returns 完整的提示词字符串
 */
export function buildAnalysisPrompt(captions: string): string {
  return `以下是一段视频的完整字幕数据，请根据上述要求整理成对话稿件。

  ${captions}`;
}
