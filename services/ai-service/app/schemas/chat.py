"""Schemas for RAG chat endpoint"""
from typing import List, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000, description="User question")
    history: Optional[List[ChatMessage]] = Field(
        default=None,
        description="Previous conversation turns (up to 10 kept)"
    )
    top_k: int = Field(default=8, ge=1, le=16, description="Number of chunks to retrieve")


class ChatSource(BaseModel):
    title: str


class ChatResponse(BaseModel):
    answer: str = Field(..., description="Generated answer")
    sources: List[str] = Field(default_factory=list, description="Knowledge base sections used")
    retrieval_count: int = Field(default=0, description="Number of chunks retrieved")
    score_max: float = Field(default=0.0, description="Maximum similarity score (0-1)")
    mode: str = Field(
        default="retrieval",
        description="Answer mode: llm_openai|llm_gemini|rulebase_fallback|retrieval|error",
    )
    latency_ms: int = Field(default=0, description="Total processing time in milliseconds")
    llm_provider: Optional[str] = Field(default=None, description="Actual provider used for this answer, or template")
    llm_model: Optional[str] = Field(default=None, description="Actual LLM model used for this answer")
    reranker_active: bool = Field(default=False, description="Whether cross-encoder reranker was active")
    rewrite_used: bool = Field(default=False, description="Whether the retrieval query was rewritten")
    rewrite_query: Optional[str] = Field(default=None, description="Rewritten retrieval query when used")
    rewrite_provider: Optional[str] = Field(default=None, description="Provider used for query rewrite")
    rewrite_model: Optional[str] = Field(default=None, description="Model used for query rewrite")
