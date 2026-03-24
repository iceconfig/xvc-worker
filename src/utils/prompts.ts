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
 * 为分段生成摘要的提示词（旧方法，保留用于兼容）
 * @param segment - 字幕段
 * @param segmentIndex - 段索引
 * @param totalSegments - 总段数
 * @returns 摘要提示词
 */
export function buildSegmentSummaryPrompt(
  segment: SubtitleEntry[],
  segmentIndex: number,
  totalSegments: number
): string {
  const segmentText = segment.map((e) => e.text).join(' ');

  return `这是视频字幕的第 ${segmentIndex + 1}/${totalSegments} 部分。请提取以下关键信息：

1. **主要话题**：这部分讨论的核心主题是什么
2. **关键数据**：任何提到的数字、统计数据、技术指标
3. **重要观点**：发言人的核心论点和结论
4. **说话者标识**：如果有明确的人名或角色，请记录

字幕内容：
${segmentText}

请用简洁的中文输出结构化摘要，保持原始术语和数据的准确性。`;
}

/**
 * 为分段直接生成稿件的提示词
 * 保留原始对话的细节和信息，仅做一次处理
 * @param segment - 字幕段
 * @param segmentIndex - 段索引
 * @param totalSegments - 总段数
 * @returns 稿件提示词
 */
export function buildSegmentDraftPrompt(
  segment: SubtitleEntry[],
  segmentIndex: number,
  totalSegments: number
): string {
  const segmentText = segment.map((e) => e.text).join(' ');

  return `这是视频字幕的第 ${segmentIndex + 1}/${totalSegments} 部分。请根据以下字幕内容，整理成对话稿件的一个片段。

要求：
- 保持原始对话的细节和信息
- 保留关键数据和技术术语
- 输出使用中文

字幕内容：
${segmentText}`;
}

/**
 * 为分段生成带重叠上下文的稿件提示词
 * 明确标识重叠部分，指导 AI 自然衔接前文
 * @param currentSegment - 当前段字幕
 * @param overlapSegment - 重叠部分（前一段的末尾），第一段为 null
 * @param segmentIndex - 段索引（从 0 开始）
 * @param totalSegments - 总段数
 * @returns 稿件提示词
 */
export function buildSegmentDraftPromptWithOverlap(
  currentSegment: SubtitleEntry[],
  overlapSegment: SubtitleEntry[] | null,
  segmentIndex: number,
  totalSegments: number
): string {
  const currentText = currentSegment.map((e) => e.text).join(' ');

  if (!overlapSegment || segmentIndex === 0) {
    // 第一段，没有重叠部分
    return `这是视频字幕的第 ${segmentIndex + 1}/${totalSegments} 部分。请根据以下字幕内容，整理成对话稿件的一个片段。

要求：
- 保持原始对话的细节和信息
- 保留关键数据和技术术语
- 输出使用中文

字幕内容：
${currentText}`;
  }

  // 有重叠部分，明确标识
  const overlapText = overlapSegment.map((e) => e.text).join(' ');

  return `这是视频字幕的第 ${segmentIndex + 1}/${totalSegments} 部分。请根据以下字幕内容，整理成对话稿件的一个片段。

【前文参考】以下是上一部分的末尾内容，供你参考上下文（不需要处理这部分）：
${overlapText}

【当前内容】请根据以下字幕内容，整理成对话稿件的一个片段：
${currentText}

要求：
- 保持原始对话的细节和信息
- 注意与前文的自然衔接
- 保留关键数据和技术术语
- 输出使用中文`;
}

/**
 * 简单拼接所有稿件片段
 * @param drafts - 各分段的稿件列表
 * @returns 拼接后的完整稿件
 */
export function joinDrafts(drafts: string[]): string {
  return drafts.join('\n\n---\n\n');
}

/**
 * 整合所有分段摘要生成最终稿件的提示词
 * @param summaries - 各分段的摘要列表
 * @returns 最终稿件提示词
 */
export function buildFinalPrompt(summaries: string[]): string {
  return `以下是视频各部分的摘要，请整合成一篇完整的对话稿件：

${summaries.map((s, i) => `## 第 ${i + 1} 部分\n${s}`).join('\n\n')}

请根据上述摘要，整理成结构清晰、对话自然的稿件。保持关键数据和术语的准确性，输出使用中文。`;
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
