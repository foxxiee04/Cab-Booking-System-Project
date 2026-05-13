import axiosInstance from './axios.config';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  message: string;
  history?: ChatMessage[];
  top_k?: number;
}

export interface ChatResponse {
  answer: string;
  sources: string[];
  retrieval_count: number;
  score_max: number;
  mode: string;
  latency_ms: number;
  llm_provider?: string | null;
  llm_model?: string | null;
  reranker_active?: boolean;
  rewrite_used?: boolean;
  rewrite_query?: string | null;
  rewrite_provider?: string | null;
  rewrite_model?: string | null;
}

export const aiApi = {
  chat: (request: ChatRequest) =>
    axiosInstance.post<ChatResponse>('/ai/chat', request),
};
