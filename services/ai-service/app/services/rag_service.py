"""
RAG (Retrieval-Augmented Generation) Service for CabBooking Customer Support.

Pipeline:
  1. Knowledge base documents are chunked and embedded at startup.
  2. Embeddings are stored in a FAISS in-memory index.
  3. On each chat request:
     a. Embed the user query.
     b. Retrieve top-k similar chunks from FAISS.
     c. Build a prompt with the retrieved context.
     d. Generate answer via LLM (if configured) or return formatted context.
"""

import logging
import os
import re
import time
from pathlib import Path
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Lazy imports — heavy libraries loaded only when the service is first used.
# ─────────────────────────────────────────────────────────────────────────────
_np = None
_faiss = None
_SentenceTransformer = None
_httpx = None


def _ensure_imports():
    global _np, _faiss, _SentenceTransformer, _httpx
    if _np is None:
        import numpy as np
        _np = np
    if _faiss is None:
        try:
            import faiss
            _faiss = faiss
        except ImportError:
            logger.warning("faiss-cpu not installed — falling back to NumPy cosine search")
    if _SentenceTransformer is None:
        from sentence_transformers import SentenceTransformer
        _SentenceTransformer = SentenceTransformer
    if _httpx is None:
        import httpx
        _httpx = httpx


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────
EMBEDDING_MODEL_NAME = os.getenv(
    "RAG_EMBEDDING_MODEL",
    "paraphrase-multilingual-MiniLM-L12-v2",  # 117 MB, supports Vietnamese
)
KNOWLEDGE_DIR = Path(__file__).resolve().parents[1] / "data" / "knowledge"
CHUNK_SIZE = 400          # characters per chunk
CHUNK_OVERLAP = 80        # overlap between consecutive chunks
TOP_K = 4                 # number of chunks to retrieve
MIN_SCORE = 0.25          # cosine similarity threshold (0-1)

# Optional LLM integration ───────────────────────────────────────────────────
LLM_PROVIDER = os.getenv("RAG_LLM_PROVIDER", "none")      # "openai" | "groq" | "none"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLM_MODEL = os.getenv("RAG_LLM_MODEL", "llama3-8b-8192")  # Groq default
LLM_TIMEOUT_S = float(os.getenv("RAG_LLM_TIMEOUT_S", "8"))
MAX_CONTEXT_CHARS = 2000


# ─────────────────────────────────────────────────────────────────────────────
# Document loading + chunking
# ─────────────────────────────────────────────────────────────────────────────

class Chunk:
    __slots__ = ("text", "source", "title")

    def __init__(self, text: str, source: str, title: str):
        self.text = text
        self.source = source
        self.title = title

    def __repr__(self):
        return f"Chunk(source={self.source!r}, title={self.title!r}, text[:50]={self.text[:50]!r})"


def _load_documents(knowledge_dir: Path) -> List[Tuple[str, str, str]]:
    """
    Load all .txt files from the knowledge directory.
    Returns list of (filename, title, full_text).
    """
    docs = []
    if not knowledge_dir.exists():
        logger.warning(f"Knowledge directory not found: {knowledge_dir}")
        return docs

    for txt_file in sorted(knowledge_dir.glob("*.txt")):
        try:
            content = txt_file.read_text(encoding="utf-8")
            # Extract TIÊU ĐỀ from first line if present
            lines = content.split("\n")
            title = txt_file.stem
            for line in lines[:3]:
                if line.startswith("TIÊU ĐỀ:"):
                    title = line.replace("TIÊU ĐỀ:", "").strip()
                    break
            docs.append((txt_file.name, title, content))
            logger.info(f"Loaded knowledge file: {txt_file.name} ({len(content)} chars)")
        except Exception as exc:
            logger.error(f"Failed to load {txt_file}: {exc}")

    return docs


def _chunk_text(text: str, chunk_size: int = CHUNK_SIZE, overlap: int = CHUNK_OVERLAP) -> List[str]:
    """
    Split text into overlapping character-level chunks.
    Tries to break at sentence/paragraph boundaries.
    """
    # Normalise whitespace
    text = re.sub(r"\n{3,}", "\n\n", text.strip())

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))

        # Try to break at a paragraph or sentence boundary within the window
        if end < len(text):
            for delim in ("\n\n", "\n", ".", "?", "!"):
                pos = text.rfind(delim, start, end)
                if pos != -1 and pos > start + overlap:
                    end = pos + len(delim)
                    break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start = end - overlap if end < len(text) else len(text)

    return chunks


def _build_chunks(docs: List[Tuple[str, str, str]]) -> List[Chunk]:
    chunks: List[Chunk] = []
    for filename, title, content in docs:
        for text in _chunk_text(content):
            chunks.append(Chunk(text=text, source=filename, title=title))
    logger.info(f"Total chunks built: {len(chunks)}")
    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# Embedding + vector index
# ─────────────────────────────────────────────────────────────────────────────

class VectorIndex:
    """Wraps FAISS (or NumPy fallback) for cosine-similarity retrieval."""

    def __init__(self, chunks: List[Chunk], embeddings):
        _ensure_imports()
        self.chunks = chunks
        np = _np

        # L2-normalise so inner product == cosine similarity
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        self.embeddings = (embeddings / norms).astype("float32")

        if _faiss is not None:
            dim = self.embeddings.shape[1]
            self.index = _faiss.IndexFlatIP(dim)
            self.index.add(self.embeddings)
            self.use_faiss = True
            logger.info(f"FAISS index built: {self.index.ntotal} vectors, dim={dim}")
        else:
            self.index = None
            self.use_faiss = False
            logger.info("Using NumPy cosine search (faiss not available)")

    def search(self, query_embedding, top_k: int = TOP_K) -> List[Tuple[float, Chunk]]:
        _ensure_imports()
        np = _np
        q = query_embedding.astype("float32")
        norm = np.linalg.norm(q)
        if norm > 0:
            q = q / norm
        q = q.reshape(1, -1)

        if self.use_faiss:
            scores, indices = self.index.search(q, top_k)
            results = []
            for score, idx in zip(scores[0], indices[0]):
                if idx >= 0 and float(score) >= MIN_SCORE:
                    results.append((float(score), self.chunks[idx]))
        else:
            # NumPy fallback
            sims = (self.embeddings @ q.T).flatten()
            top_indices = np.argsort(sims)[::-1][:top_k]
            results = [
                (float(sims[i]), self.chunks[i])
                for i in top_indices
                if float(sims[i]) >= MIN_SCORE
            ]

        return results


# ─────────────────────────────────────────────────────────────────────────────
# LLM answer generation
# ─────────────────────────────────────────────────────────────────────────────

def _format_context(retrieved: List[Tuple[float, Chunk]]) -> str:
    parts = []
    for _, chunk in retrieved:
        parts.append(f"--- {chunk.title} ---\n{chunk.text}")
    return "\n\n".join(parts)


def _template_answer(query: str, retrieved: List[Tuple[float, Chunk]]) -> str:
    """
    Build a structured answer from retrieved chunks when no LLM is configured.
    Surfaces the most relevant chunk text plus source titles.
    """
    if not retrieved:
        return (
            "Xin lỗi, tôi chưa tìm thấy thông tin phù hợp với câu hỏi của bạn. "
            "Vui lòng liên hệ hỗ trợ qua email support@cabbooking.vn hoặc hotline 1900-XXXX."
        )

    # Best chunk text as the main answer
    best_score, best_chunk = retrieved[0]
    answer_parts = [best_chunk.text.strip()]

    # Append additional relevant info from other chunks (avoid duplicates)
    seen_sources = {best_chunk.source}
    for _, chunk in retrieved[1:]:
        if chunk.source not in seen_sources and chunk.title != best_chunk.title:
            answer_parts.append(f"\n📌 {chunk.title}:\n{chunk.text.strip()}")
            seen_sources.add(chunk.source)
            if len("\n\n".join(answer_parts)) > 1200:
                break

    return "\n\n".join(answer_parts)


async def _call_llm_groq(system_prompt: str, user_message: str) -> Optional[str]:
    """Call Groq API (free tier, very fast)."""
    if not GROQ_API_KEY:
        return None
    try:
        async with _httpx.AsyncClient(timeout=LLM_TIMEOUT_S) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": 512,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"Groq LLM call failed: {exc}")
        return None


async def _call_llm_openai(system_prompt: str, user_message: str) -> Optional[str]:
    """Call OpenAI API."""
    if not OPENAI_API_KEY:
        return None
    try:
        async with _httpx.AsyncClient(timeout=LLM_TIMEOUT_S) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": os.getenv("RAG_LLM_MODEL", "gpt-3.5-turbo"),
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_message},
                    ],
                    "max_tokens": 512,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"OpenAI LLM call failed: {exc}")
        return None


async def _generate_answer(query: str, retrieved: List[Tuple[float, Chunk]]) -> Tuple[str, str]:
    """
    Generate the final answer. Returns (answer_text, mode).
    mode is one of: 'llm_groq' | 'llm_openai' | 'retrieval'
    """
    if not retrieved:
        return _template_answer(query, []), "retrieval"

    context = _format_context(retrieved)[:MAX_CONTEXT_CHARS]

    system_prompt = (
        "Bạn là trợ lý hỗ trợ khách hàng của dịch vụ đặt xe CabBooking. "
        "Hãy trả lời câu hỏi của khách hàng dựa trên thông tin trong ngữ cảnh được cung cấp. "
        "Trả lời bằng tiếng Việt, ngắn gọn, thân thiện và chính xác. "
        "Nếu thông tin không có trong ngữ cảnh, hãy nói rõ và hướng dẫn liên hệ hỗ trợ.\n\n"
        f"NGỮ CẢNH:\n{context}"
    )

    if LLM_PROVIDER == "groq" or (LLM_PROVIDER == "auto" and GROQ_API_KEY):
        answer = await _call_llm_groq(system_prompt, query)
        if answer:
            return answer, "llm_groq"

    if LLM_PROVIDER == "openai" or (LLM_PROVIDER == "auto" and OPENAI_API_KEY):
        answer = await _call_llm_openai(system_prompt, query)
        if answer:
            return answer, "llm_openai"

    # Fallback: template-based retrieval answer
    return _template_answer(query, retrieved), "retrieval"


# ─────────────────────────────────────────────────────────────────────────────
# Main RAG Service class
# ─────────────────────────────────────────────────────────────────────────────

class RagService:
    """
    Singleton RAG service.
    Initialised lazily on first request to avoid blocking startup.
    """

    def __init__(self):
        self._ready = False
        self._model = None
        self._index: Optional[VectorIndex] = None
        self._chunks: List[Chunk] = []
        self._init_error: Optional[str] = None

    def initialize(self) -> bool:
        """Load embedding model + build FAISS index from knowledge base."""
        if self._ready:
            return True
        try:
            _ensure_imports()
            t0 = time.time()

            logger.info(f"Loading embedding model: {EMBEDDING_MODEL_NAME}")
            self._model = _SentenceTransformer(EMBEDDING_MODEL_NAME)

            docs = _load_documents(KNOWLEDGE_DIR)
            if not docs:
                logger.warning("No knowledge documents found — RAG will return empty results")

            self._chunks = _build_chunks(docs)

            if self._chunks:
                logger.info(f"Encoding {len(self._chunks)} chunks...")
                texts = [c.text for c in self._chunks]
                embeddings = self._model.encode(
                    texts, batch_size=32, show_progress_bar=False, normalize_embeddings=True
                )
                self._index = VectorIndex(self._chunks, embeddings)

            elapsed = time.time() - t0
            logger.info(f"RAG service ready in {elapsed:.2f}s")
            self._ready = True
            return True

        except Exception as exc:
            self._init_error = str(exc)
            logger.error(f"RAG initialization failed: {exc}", exc_info=True)
            return False

    @property
    def is_ready(self) -> bool:
        return self._ready

    async def chat(
        self,
        message: str,
        history: Optional[List[dict]] = None,
        top_k: int = TOP_K,
    ) -> dict:
        """
        Main RAG chat method.

        Args:
            message: User's question (Vietnamese or English).
            history: Optional conversation history [{"role": "user"|"assistant", "content": "..."}].
            top_k: Number of chunks to retrieve.

        Returns:
            dict with keys: answer, sources, retrieval_count, score_max, mode, latency_ms.
        """
        t0 = time.time()

        if not self._ready:
            success = self.initialize()
            if not success:
                return {
                    "answer": (
                        "Hệ thống hỗ trợ AI đang khởi động. Vui lòng thử lại sau ít phút "
                        "hoặc liên hệ support@cabbooking.vn."
                    ),
                    "sources": [],
                    "retrieval_count": 0,
                    "score_max": 0.0,
                    "mode": "error",
                    "latency_ms": int((time.time() - t0) * 1000),
                    "error": self._init_error,
                }

        retrieved: List[Tuple[float, Chunk]] = []
        if self._index is not None and message.strip():
            query_emb = self._model.encode([message.strip()], normalize_embeddings=True)
            retrieved = self._index.search(query_emb[0], top_k=top_k)

        answer, mode = await _generate_answer(message, retrieved)

        sources = list({chunk.title for _, chunk in retrieved})
        score_max = max((s for s, _ in retrieved), default=0.0)

        return {
            "answer": answer,
            "sources": sources,
            "retrieval_count": len(retrieved),
            "score_max": round(float(score_max), 4),
            "mode": mode,
            "latency_ms": int((time.time() - t0) * 1000),
        }


# Module-level singleton
rag_service = RagService()
