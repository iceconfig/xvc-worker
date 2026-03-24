/**
 * LLM 流式调用可选配置
 */
export interface LLMStreamOpts {
  model?: string;           // 模型名称，默认使用各服务的默认模型
  temperature?: number;     // 温度参数，控制输出随机性 (0-1)
  maxOutputTokens?: number; // 最大输出 token 数
}

/**
 * LLM 流式响应数据块
 */
export interface LLMStreamResponse {
  text: string;   // 当前文本块内容
  done: boolean;  // 是否流结束标记
}
