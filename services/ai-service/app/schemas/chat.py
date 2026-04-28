"""Schemas for RAG chat endpoint"""
from typing import List, Optional
from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=1000, description="User question")
    history: Optional[List[ChatMessage]] = Field(
        default=None,
        description="Previous conversation turns (up to 10 kept)"
    )
    top_k: int = Field(default=4, ge=1, le=10, description="Number of chunks to retrieve")


class ChatSource(BaseModel):
    title: str


class ChatResponse(BaseModel):
    answer: str = Field(..., description="Generated answer")
    sources: List[str] = Field(default_factory=list, description="Knowledge base sections used")
    retrieval_count: int = Field(default=0, description="Number of chunks retrieved")
    score_max: float = Field(default=0.0, description="Maximum similarity score (0-1)")
    mode: str = Field(default="retrieval", description="Answer mode: llm_groq|llm_openai|retrieval|error")
    latency_ms: int = Field(default=0, description="Total processing time in milliseconds")
