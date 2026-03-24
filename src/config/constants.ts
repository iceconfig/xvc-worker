/**
 * 全局常量配置
 */

// DeepSeek API 限制
export const DEEPSEEK_MAX_INPUT_TOKENS = 30000;
export const DEEPSEEK_MAX_OUTPUT_TOKENS = 4000;
export const DEEPSEEK_SEGMENT_TARGET_TOKENS = 8000;

// 安全余量后的实际输入限制
export const MAX_INPUT_TOKENS = DEEPSEEK_MAX_INPUT_TOKENS - 2000; // 28000

// 分段重叠配置
// 每段与前一段的重叠条目数，用于提供上下文保证连贯性
export const SEGMENT_OVERLAP_ENTRIES = 50;
