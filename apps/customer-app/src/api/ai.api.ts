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
}

export const aiApi = {
  chat: (request: ChatRequest) =>
    axiosInstance.post<ChatResponse>('/ai/chat', request),
};
