/**
 * Token 估算工具
 */

/**
 * 估算文本的 token 数量
 * 使用简单的字符估算方法（中文字符约 1.5 token/字，英文约 0.25 token/词）
 * @param text - 要估算的文本
 * @returns 估算的 token 数量
 */
export function estimateTokens(text: string): number {
  const chineseChars = (text.match(/[\u4e00-\u9fff]/g) || []).length;
  const englishWords = (text.match(/[a-zA-Z]+/g) || []).length;
  const otherChars = text.length - chineseChars;
  // 中文约 1.5 token/字，英文约 0.25 token/词，其他字符约 0.5 token
  return Math.floor(chineseChars * 1.5 + englishWords * 0.25 + otherChars * 0.5);
}
