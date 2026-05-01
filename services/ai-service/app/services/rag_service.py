"""
RAG (Retrieval-Augmented Generation) Service for FoxGo Customer Support.

Pipeline:
  1. Knowledge base documents are chunked and embedded at startup.
  2. Embeddings are stored in a FAISS in-memory index.
  3. On each chat request:
     a. Enrich the query with recent conversation history.
     b. Embed the enriched query.
     c. Retrieve top-k similar chunks from FAISS.
     d. Build a prompt with context + full history.
     e. Generate answer via LLM (if configured) or return formatted context.
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
CHUNK_SIZE = 600          # characters per chunk (larger = more context per chunk)
CHUNK_OVERLAP = 100       # overlap between consecutive chunks
TOP_K = 5                 # number of chunks to retrieve
MIN_SCORE = 0.30          # cosine similarity threshold (raised for better precision)

# Optional LLM integration ───────────────────────────────────────────────────
LLM_PROVIDER = os.getenv("RAG_LLM_PROVIDER", "none")      # "openai" | "groq" | "none"
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLM_MODEL = os.getenv("RAG_LLM_MODEL", "llama3-8b-8192")  # Groq default
LLM_TIMEOUT_S = float(os.getenv("RAG_LLM_TIMEOUT_S", "8"))
MAX_CONTEXT_CHARS = 2500
MAX_HISTORY_TURNS = 6     # number of recent history messages sent to LLM


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
    """Split text into overlapping character-level chunks at natural boundaries."""
    text = re.sub(r"\n{3,}", "\n\n", text.strip())

    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))

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
            sims = (self.embeddings @ q.T).flatten()
            top_indices = np.argsort(sims)[::-1][:top_k]
            results = [
                (float(sims[i]), self.chunks[i])
                for i in top_indices
                if float(sims[i]) >= MIN_SCORE
            ]

        return results


# ─────────────────────────────────────────────────────────────────────────────
# Query enrichment using history
# ─────────────────────────────────────────────────────────────────────────────

def _enrich_query(query: str, history: Optional[List[dict]]) -> str:
    """
    For short or ambiguous queries (e.g., "còn cái nào khác?"), prepend the
    last user message so embedding captures the right topic.
    Only enriches when query is short (≤ 6 words) and history exists.
    """
    if not history or len(query.split()) > 6:
        return query
    recent_user = [h["content"] for h in history[-6:] if h.get("role") == "user"]
    if len(recent_user) >= 2:
        # Prepend the previous user turn as context
        return f"{recent_user[-2]} {query}"
    return query


# ─────────────────────────────────────────────────────────────────────────────
# LLM answer generation
# ─────────────────────────────────────────────────────────────────────────────

def _format_context(retrieved: List[Tuple[float, Chunk]]) -> str:
    parts = []
    for _, chunk in retrieved:
        parts.append(f"[{chunk.title}]\n{chunk.text}")
    return "\n\n".join(parts)


def _format_history(history: List[dict]) -> str:
    """Format recent conversation turns for the LLM prompt."""
    lines = []
    for msg in history[-MAX_HISTORY_TURNS:]:
        role = "Khách hàng" if msg.get("role") == "user" else "Trợ lý"
        lines.append(f"{role}: {msg['content']}")
    return "\n".join(lines)


def _template_answer(query: str, retrieved: List[Tuple[float, Chunk]]) -> str:
    """
    Build a clean, formatted answer from retrieved chunks when no LLM is configured.
    Applies light markdown formatting for readability.
    """
    if not retrieved:
        return (
            "Xin lỗi, mình chưa tìm thấy thông tin phù hợp với câu hỏi của bạn 😔\n\n"
            "Bạn có thể thử hỏi theo cách khác, hoặc liên hệ hỗ trợ trực tiếp:\n"
            "• Email: support@foxgo.vn\n"
            "• Hotline: 1900-1234 (8h–22h)"
        )

    best_score, best_chunk = retrieved[0]

    # Clean up the raw chunk text: remove metadata lines (TIÊU ĐỀ, DANH MỤC)
    def clean_chunk(text: str) -> str:
        lines = text.split("\n")
        cleaned = [l for l in lines if not l.startswith(("TIÊU ĐỀ:", "DANH MỤC:"))]
        return "\n".join(cleaned).strip()

    main_text = clean_chunk(best_chunk.text)

    # If there are additional relevant chunks from different topics, append briefly
    answer_parts = [main_text]
    seen_sources = {best_chunk.source}
    for _, chunk in retrieved[1:]:
        if chunk.source not in seen_sources:
            extra = clean_chunk(chunk.text)
            if extra and len("\n\n".join(answer_parts)) + len(extra) < 1400:
                answer_parts.append(extra)
            seen_sources.add(chunk.source)

    return "\n\n".join(answer_parts)


async def _call_llm_groq(system_prompt: str, messages: List[dict]) -> Optional[str]:
    """Call Groq API with full message history."""
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
                    "messages": [{"role": "system", "content": system_prompt}] + messages,
                    "max_tokens": 600,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"Groq LLM call failed: {exc}")
        return None


async def _call_llm_openai(system_prompt: str, messages: List[dict]) -> Optional[str]:
    """Call OpenAI API with full message history."""
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
                    "messages": [{"role": "system", "content": system_prompt}] + messages,
                    "max_tokens": 600,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"OpenAI LLM call failed: {exc}")
        return None


async def _generate_answer(
    query: str,
    retrieved: List[Tuple[float, Chunk]],
    history: Optional[List[dict]] = None,
) -> Tuple[str, str]:
    """
    Generate the final answer using LLM (if configured) or template fallback.
    Returns (answer_text, mode).
    """
    if not retrieved:
        return _template_answer(query, []), "retrieval"

    context = _format_context(retrieved)[:MAX_CONTEXT_CHARS]

    system_prompt = (
        "Bạn là Trợ lý FoxGo — AI hỗ trợ khách hàng của ứng dụng gọi xe FoxGo tại Việt Nam.\n"
        "Nhiệm vụ: Trả lời câu hỏi của khách hàng dựa trên THÔNG TIN bên dưới.\n\n"
        "Quy tắc bắt buộc:\n"
        "1. Chỉ dùng thông tin trong phần NGỮ CẢNH — KHÔNG bịa đặt số liệu hay chính sách.\n"
        "2. Trả lời bằng tiếng Việt, thân thiện, ngắn gọn (tối đa 150 từ).\n"
        "3. Dùng gạch đầu dòng (•) khi liệt kê nhiều mục.\n"
        "4. Nếu câu hỏi không có trong ngữ cảnh, nói rõ và hướng dẫn: "
        "email support@foxgo.vn hoặc hotline 1900-1234.\n"
        "5. Không lặp lại câu hỏi của khách hàng.\n\n"
        f"NGỮ CẢNH:\n{context}"
    )

    # Build message list: history + current query
    llm_messages: List[dict] = []
    if history:
        for msg in history[-MAX_HISTORY_TURNS:]:
            role = msg.get("role", "user")
            if role in ("user", "assistant"):
                llm_messages.append({"role": role, "content": msg["content"]})
    llm_messages.append({"role": "user", "content": query})

    if LLM_PROVIDER == "groq" or (LLM_PROVIDER == "auto" and GROQ_API_KEY):
        answer = await _call_llm_groq(system_prompt, llm_messages)
        if answer:
            return answer, "llm_groq"

    if LLM_PROVIDER == "openai" or (LLM_PROVIDER == "auto" and OPENAI_API_KEY):
        answer = await _call_llm_openai(system_prompt, llm_messages)
        if answer:
            return answer, "llm_openai"

    return _template_answer(query, retrieved), "retrieval"


# ─────────────────────────────────────────────────────────────────────────────
# Main RAG Service class
# ─────────────────────────────────────────────────────────────────────────────

class RagService:
    """Singleton RAG service. Initialised lazily on first request."""

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
            message: User's question (Vietnamese).
            history: Conversation history [{"role": "user"|"assistant", "content": "..."}].
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
                        "hoặc liên hệ support@foxgo.vn."
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
            # Enrich short/ambiguous queries with context from history
            search_query = _enrich_query(message.strip(), history)
            query_emb = self._model.encode([search_query], normalize_embeddings=True)
            retrieved = self._index.search(query_emb[0], top_k=top_k)

        answer, mode = await _generate_answer(message, retrieved, history=history)

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
