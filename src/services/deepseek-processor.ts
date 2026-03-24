import type { SubtitleEntry } from './youtube';
import type { LLMStreamResponse } from '../types/llm';
import { splitSubtitles, buildSegmentDraftPromptWithOverlap } from '../utils/prompts';
import { estimateTokens } from '../utils/tokenizer';
import { streamDeepSeekWithResponse } from './deepseek-client';
import { DEEPSEEK_SEGMENT_TARGET_TOKENS, SEGMENT_OVERLAP_ENTRIES } from '../config/constants';

/**
 * 处理长字幕的分段稿件生成和流式返回
 * 当字幕超出模型输入限制时，分段直接生成稿件后流式返回，保留更多原始信息
 * 使用重叠字幕方案：每段包含前一段的部分字幕作为上下文，保证连贯性
 * @param subtitles - 完整字幕列表
 * @param apiKey - DeepSeek API 密钥
 * @returns 异步生成器，流式返回结果
 */
export async function* processLongSubtitles(
  subtitles: SubtitleEntry[],
  apiKey: string
): AsyncGenerator<LLMStreamResponse> {
  // 分割字幕（使用重叠方案）
  const segments = splitSubtitles(subtitles, DEEPSEEK_SEGMENT_TARGET_TOKENS, SEGMENT_OVERLAP_ENTRIES);

  console.log(`[deepseek] 分段处理：共 ${segments.length} 段（重叠条目数：${SEGMENT_OVERLAP_ENTRIES}）`);

  // 逐段生成稿件并流式返回
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    const segmentTokens = estimateTokens(segment.map((e) => e.text).join(' '));

    console.log(
      `[deepseek] 处理第 ${i + 1}/${segments.length} 段 (${segmentTokens} tokens)`
    );

    // 构建带重叠上下文的提示词
    // 重叠部分：当前段之前的条目（即上一段的末尾）
    // 由于 splitSubtitles 已经将重叠部分包含在当前段中，我们需要分离出重叠部分
    let prompt: string;

    if (i === 0) {
      // 第一段，没有重叠上下文
      prompt = buildSegmentDraftPromptWithOverlap(segment, null, i, segments.length);
    } else {
      // 后续段：需要确定重叠部分
      // 重叠部分是从段首开始的 SEGMENT_OVERLAP_ENTRIES 条字幕
      const overlapCount = Math.min(SEGMENT_OVERLAP_ENTRIES, segment.length);
      const overlapSegment = segment.slice(0, overlapCount);
      const currentSegment = segment.slice(overlapCount);

      if (currentSegment.length > 0) {
        // 有非重叠的当前内容
        prompt = buildSegmentDraftPromptWithOverlap(currentSegment, overlapSegment, i, segments.length);
      } else {
        // 整个段都是重叠部分（边界情况）
        prompt = buildSegmentDraftPromptWithOverlap(segment, overlapSegment, i, segments.length);
      }
    }

    // 流式返回当前段的稿件内容
    for await (const chunk of streamDeepSeekWithResponse(prompt, apiKey)) {
      yield chunk;
    }

    console.log(
      `[deepseek] 第 ${i + 1} 段稿件完成`
    );

    // 在段与段之间添加分隔符（可选）
    if (i < segments.length - 1) {
      yield { text: '\n\n---\n\n', done: false };
    }
  }

  console.log(`[deepseek] 所有段落处理完成`);

  // 发送结束标记
  yield { text: '', done: true };
}
