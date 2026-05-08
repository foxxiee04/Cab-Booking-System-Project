"""
RAG (Retrieval-Augmented Generation) Service for FoxGo Customer Support.

Pipeline:
  1. Knowledge base documents are chunked (Q&A-aware) and embedded at startup.
  2. Embeddings stored in a FAISS in-memory index; BM25 index built in parallel.
  3. On each chat request:
     a. Enrich the query with recent conversation history.
     b. Embed the enriched query + BM25 tokenize.
     c. Hybrid search: FAISS (semantic) + BM25 (keyword) → Reciprocal Rank Fusion.
     d. Build a prompt with context + full history.
     e. Generate a natural, human-like answer via LLM (Claude → Groq → Gemini → OpenAI → template).
"""

import logging
import os
import re
import threading
import time
import unicodedata
from pathlib import Path
from typing import List, Optional, Tuple

logger = logging.getLogger(__name__)

# ─────────────────────────────────────────────────────────────────────────────
# Lazy imports
# ─────────────────────────────────────────────────────────────────────────────
_np = None
_faiss = None
_SentenceTransformer = None
_httpx = None
_BM25Okapi = None


def _ensure_imports():
    global _np, _faiss, _SentenceTransformer, _httpx, _BM25Okapi
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
    if _BM25Okapi is None:
        try:
            from rank_bm25 import BM25Okapi
            _BM25Okapi = BM25Okapi
        except ImportError:
            logger.warning("rank_bm25 not installed — BM25 search disabled, using semantic only")


# ─────────────────────────────────────────────────────────────────────────────
# Configuration
# ─────────────────────────────────────────────────────────────────────────────
EMBEDDING_MODEL_NAME = os.getenv(
    "RAG_EMBEDDING_MODEL",
    "paraphrase-multilingual-MiniLM-L12-v2",
)
KNOWLEDGE_DIR = Path(__file__).resolve().parents[1] / "data" / "knowledge"
CHUNK_SIZE = 450
CHUNK_OVERLAP = 80
TOP_K = int(os.getenv("RAG_TOP_K", "8"))
# Cosine similarity on normalized embeddings (inner product). NOT the same as RRF scores.
MIN_SEMANTIC_RETURN = float(os.getenv("RAG_MIN_SEMANTIC", "0.35"))  # legacy `search()` threshold
MIN_FAISS_PREFILTER = float(os.getenv("RAG_FAISS_PREFILTER", "0.16"))  # widen recall into RRF pool
MAX_CONTEXT_CHARS = int(os.getenv("RAG_MAX_CONTEXT_CHARS", "6400"))
# Hybrid gating: RRF scores are ~0.02–0.15 — never compare them to cosine.
RAG_COSINE_ABSENT = float(os.getenv("RAG_COSINE_ABSENT", "0.22"))  # below → no relevant KB hit
RAG_COSINE_LLM = float(os.getenv("RAG_COSINE_LLM", "0.30"))  # at/above → allow LLM synthesis

# LLM provider priority: claude → groq → gemini → openai → template
LLM_PROVIDER = os.getenv("RAG_LLM_PROVIDER", "auto")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
LLM_MODEL_CLAUDE = os.getenv("RAG_LLM_MODEL_CLAUDE", "claude-haiku-4-5-20251001")
LLM_MODEL_GROQ = os.getenv("RAG_LLM_MODEL", "llama3-8b-8192")
LLM_MODEL_OPENAI = os.getenv("RAG_LLM_MODEL_OPENAI", "gpt-3.5-turbo")
LLM_MODEL_GEMINI = os.getenv("RAG_LLM_MODEL_GEMINI", "gemini-2.0-flash")
LLM_TIMEOUT_S = float(os.getenv("RAG_LLM_TIMEOUT_S", "14"))
LLM_MAX_TOKENS = int(os.getenv("RAG_LLM_MAX_TOKENS", "768"))
LLM_TEMPERATURE = float(os.getenv("RAG_LLM_TEMPERATURE", "0.22"))
MAX_HISTORY_TURNS = 8

# ─────────────────────────────────────────────────────────────────────────────
# System prompt — Mia persona (accuracy-first)
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Bạn là Mia — trợ lý CSKH FoxGo (ứng dụng gọi xe). Nhiệm vụ: trả lời ĐÚNG, RÕ, ĐỦ Ý — văn phong tự nhiên, tránh trả lời chung chung hoặc lặp câu chào máy móc.

VAI TRÒ NGƯỜI DÙNG:
- Nếu người dùng nói rõ (hoặc ngữ cảnh cho thấy) họ là **khách** vs **tài xế**, trả lời đúng góc: khách thì ưu tiên luồng đặt xe/thanh toán/CSKH **support@foxgo.vn**; tài xế thì ưu tiên nhận cuốc/GPS/ví/hoa hồng/CS **driver-support@foxgo.vn**.
- Câu hỏi tổng quát thì trả lời trung tính — không ép khuôn “chỉ khách” hoặc “chỉ tài xế”.

NGUỒN DUY NHẤT:
- Chỉ dùng nội dung trong phần "NGỮ CẢNH TÌM ĐƯỢC" do hệ thống cung cấp kèm câu hỏi.
- Không dùng kiến thức thế giới mở. Không đoán mò số liệu, giá, chính sách, tên dịch vụ, hoặc luồng kỹ thuật nếu không ghi trong ngữ cảnh.

KHI ĐỦ THÔNG TIN:
- Trả lời trực tiếp câu hỏi; ưu tiên gạch đầu dòng hoặc bước 1,2,3 nếu là hướng dẫn.
- Có thể dài tới ~250 từ nếu cần nhiều bước; tránh lặp ý.
- Nếu ngữ cảnh có **Đáp:** hoặc Q&A, giữ đúng ý chính — diễn đạt lại mượt hơn được, không được thêm ý mới.

KHI THIẾU HOẶC CHỈ LIÊN QUAN MỘT PHẦN:
- Nói rõ phần nào có/không có trong kho tri thức. Ví dụ: "Trong tài liệu FoxGo mình có [X]; phần [Y] mình chưa có chi tiết."
- Kết thúc bằng một câu: hotline **1900-1234** (8h–22h) và/hoặc email **support@foxgo.vn** / **driver-support@foxgo.vn** tùy ngữ cảnh (chỉ nêu email có trong ngữ cảnh hoặc đã là chuẩn FoxGo trong đoạn trích).

KHÔNG ĐƯỢC:
- Giả làm đã tra cứu bên ngoài. Không nói "theo internet". Không hứa thao tác trong app thay người dùng.

Giọng điệu: thân thiện, xưng "mình", gọi người dùng là "bạn"; emoji tối đa 1–2, chỉ khi hợp ngữ cảnh."""


# ─────────────────────────────────────────────────────────────────────────────
# Document loading + Q&A-aware chunking
# ─────────────────────────────────────────────────────────────────────────────

class Chunk:
    __slots__ = ("text", "source", "title")

    def __init__(self, text: str, source: str, title: str):
        self.text = text
        self.source = source
        self.title = title

    def __repr__(self):
        return f"Chunk(source={self.source!r}, text[:60]={self.text[:60]!r})"


def _load_documents(knowledge_dir: Path) -> List[Tuple[str, str, str]]:
    docs = []
    if not knowledge_dir.exists():
        logger.warning(f"Knowledge directory not found: {knowledge_dir}")
        return docs

    for txt_file in sorted(knowledge_dir.glob("*.txt")):
        try:
            content = txt_file.read_text(encoding="utf-8")
            title = txt_file.stem
            for line in content.split("\n")[:5]:
                if line.startswith("TIÊU ĐỀ:"):
                    title = line.replace("TIÊU ĐỀ:", "").strip()
                    break
            docs.append((txt_file.name, title, content))
            logger.info(f"Loaded: {txt_file.name} ({len(content)} chars)")
        except Exception as exc:
            logger.error(f"Failed to load {txt_file}: {exc}")

    return docs


def _split_qa_pairs(text: str) -> List[str]:
    """
    Split a document into Q&A blocks first, then into size-limited chunks.
    Keeps each Hỏi/Đáp pair together so retrieval always returns complete answers.
    """
    text = re.sub(r"\n{3,}", "\n\n", text.strip())

    qa_pattern = re.compile(r"(?=\nHỏi:|\nQ:)", re.MULTILINE)
    parts = qa_pattern.split(text)

    segments = []
    intro_text = parts[0].strip()

    if intro_text:
        segments.extend(_chunk_by_size(intro_text, CHUNK_SIZE, CHUNK_OVERLAP))

    for part in parts[1:]:
        part = part.strip()
        if not part:
            continue
        if len(part) <= CHUNK_SIZE + 200:
            segments.append(part)
        else:
            segments.extend(_chunk_by_size(part, CHUNK_SIZE, CHUNK_OVERLAP))

    return segments


def _chunk_by_size(text: str, chunk_size: int, overlap: int) -> List[str]:
    """Standard character-level chunking with overlap, breaking at natural boundaries."""
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            for delim in ("\n\n", "\n", ".", "?", "!"):
                pos = text.rfind(delim, start + overlap, end)
                if pos != -1:
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
        for seg in _split_qa_pairs(content):
            lines = [
                l for l in seg.split("\n")
                if l.strip() and not l.startswith(("TIÊU ĐỀ:", "DANH MỤC:"))
            ]
            clean = "\n".join(lines).strip()
            if clean:
                chunks.append(Chunk(text=clean, source=filename, title=title))

    logger.info(f"Total chunks: {len(chunks)}")
    return chunks


# ─────────────────────────────────────────────────────────────────────────────
# BM25 tokenizer (Vietnamese-aware)
# ─────────────────────────────────────────────────────────────────────────────

# Common Vietnamese stop words that hurt BM25 precision
_VI_STOPWORDS = {
    "và", "của", "là", "có", "không", "được", "trong", "để", "cho", "với",
    "các", "những", "này", "đó", "khi", "thì", "từ", "về", "một", "hay",
    "hoặc", "nếu", "thế", "vậy", "cũng", "đã", "sẽ", "đang", "bị", "rồi",
    "mà", "như", "do", "vì", "nên", "ra", "lên", "xuống", "vào", "tôi",
    "bạn", "mình", "ạ", "nhé", "thôi", "à", "ơi", "xin", "hỏi", "đáp",
}


def _strip_diacritics(text: str) -> str:
    """'tiền hoàn' → 'tien hoan' — lets users type without diacritics and still match."""
    return "".join(
        c for c in unicodedata.normalize("NFKD", text)
        if not unicodedata.combining(c)
    )


# Pre-compute stripped stopwords so membership check stays O(1)
_VI_STOPWORDS_STRIPPED = {_strip_diacritics(w) for w in _VI_STOPWORDS}


def _tokenize_vi(text: str) -> List[str]:
    """Lowercase → strip diacritics → remove punctuation → split → filter stops."""
    text = text.lower()
    text = _strip_diacritics(text)
    text = re.sub(r"[^\w\s]", " ", text)
    return [t for t in text.split() if t and t not in _VI_STOPWORDS_STRIPPED]


# ─────────────────────────────────────────────────────────────────────────────
# Vector + BM25 hybrid index
# ─────────────────────────────────────────────────────────────────────────────

class VectorIndex:
    def __init__(self, chunks: List[Chunk], embeddings):
        _ensure_imports()
        np = _np
        self.chunks = chunks
        self.n = len(chunks)

        # Normalize embeddings for cosine similarity via inner product
        norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1.0, norms)
        self.embeddings = (embeddings / norms).astype("float32")

        # FAISS index
        if _faiss is not None:
            dim = self.embeddings.shape[1]
            self.index = _faiss.IndexFlatIP(dim)
            self.index.add(self.embeddings)
            self.use_faiss = True
            logger.info(f"FAISS index: {self.index.ntotal} vectors, dim={dim}")
        else:
            self.index = None
            self.use_faiss = False

        # BM25 index
        self.bm25 = None
        if _BM25Okapi is not None:
            tokenized = [_tokenize_vi(c.text) for c in chunks]
            self.bm25 = _BM25Okapi(tokenized)
            logger.info("BM25 index built alongside FAISS")

    def _semantic_ranks(self, query_embedding, k: int) -> dict:
        """Return {chunk_idx: rrf_contribution} from semantic search."""
        _ensure_imports()
        np = _np
        q = query_embedding.astype("float32")
        norm = np.linalg.norm(q)
        if norm > 0:
            q = q / norm
        q = q.reshape(1, -1)

        ranks = {}
        if self.use_faiss:
            scores, indices = self.index.search(q, k)
            for rank, (score, idx) in enumerate(zip(scores[0], indices[0])):
                if idx >= 0 and float(score) >= MIN_FAISS_PREFILTER:
                    ranks[int(idx)] = 1.0 / (60 + rank)
        else:
            sims = (self.embeddings @ q.T).flatten()
            top = np.argsort(sims)[::-1][:k]
            for rank, idx in enumerate(top):
                if float(sims[idx]) >= MIN_FAISS_PREFILTER:
                    ranks[int(idx)] = 1.0 / (60 + rank)
        return ranks

    def _bm25_ranks(self, query_text: str, k: int) -> dict:
        """Return {chunk_idx: rrf_contribution} from BM25 keyword search."""
        if self.bm25 is None:
            return {}
        _ensure_imports()
        np = _np
        tokens = _tokenize_vi(query_text)
        if not tokens:
            return {}
        scores = self.bm25.get_scores(tokens)
        top = np.argsort(scores)[::-1][:k]
        ranks = {}
        for rank, idx in enumerate(top):
            if float(scores[idx]) > 0:
                ranks[int(idx)] = 1.0 / (60 + rank)
        return ranks

    def search_hybrid(
        self,
        query_embedding,
        query_text: str,
        top_k: int = TOP_K,
    ) -> List[Tuple[float, float, Chunk]]:
        """
        Hybrid RRF (semantic + BM25) ranking. Returns tuples of
        (rrf_score, cosine_similarity, chunk) — **cosine** must be used for confidence gating.
        """
        k_inner = min(top_k * 3, self.n)

        semantic = self._semantic_ranks(query_embedding, k_inner)
        bm25 = self._bm25_ranks(query_text, k_inner)

        all_indices = set(semantic.keys()) | set(bm25.keys())
        if not all_indices:
            return []

        rrf = {i: semantic.get(i, 0.0) + bm25.get(i, 0.0) for i in all_indices}
        top_indices = sorted(rrf.keys(), key=lambda i: -rrf[i])[:top_k]

        _ensure_imports()
        np = _np
        q = query_embedding.astype("float32")
        norm = np.linalg.norm(q)
        if norm > 0:
            q = q / norm
        q1 = q.flatten()

        out: List[Tuple[float, float, Chunk]] = []
        for i in top_indices:
            cos = float(np.dot(self.embeddings[i], q1))
            out.append((float(rrf[i]), cos, self.chunks[i]))
        return out

    def search(self, query_embedding, top_k: int = TOP_K) -> List[Tuple[float, Chunk]]:
        """Pure semantic search (kept for compatibility)."""
        _ensure_imports()
        np = _np
        q = query_embedding.astype("float32")
        norm = np.linalg.norm(q)
        if norm > 0:
            q = q / norm
        q = q.reshape(1, -1)

        if self.use_faiss:
            scores, indices = self.index.search(q, top_k)
            return [
                (float(score), self.chunks[idx])
                for score, idx in zip(scores[0], indices[0])
                if idx >= 0 and float(score) >= MIN_SEMANTIC_RETURN
            ]
        else:
            sims = (self.embeddings @ q.T).flatten()
            top = _np.argsort(sims)[::-1][:top_k]
            return [
                (float(sims[i]), self.chunks[i])
                for i in top
                if float(sims[i]) >= MIN_SEMANTIC_RETURN
            ]


# ─────────────────────────────────────────────────────────────────────────────
# Query enrichment
# ─────────────────────────────────────────────────────────────────────────────

# Patterns that indicate the user is referring back to a previous topic
_FOLLOWUP_PATTERN = re.compile(
    r"\b(nó|cái đó|vậy thì|thế thì|thế còn|còn nếu|vậy|đó|ấy|như vậy|khi đó"
    r"|còn|thế|ý đó|trường hợp đó|vấn đề đó|phần đó|bước đó|cách đó"
    r"|mấy cái|những cái|sao vậy|tại sao vậy|rồi sao)\b",
    re.IGNORECASE,
)


def _enrich_query(query: str, history: Optional[List[dict]]) -> str:
    """
    Enrich short/ambiguous queries with context from recent conversation.
    Handles Vietnamese follow-up pronouns and short confirmations.
    """
    if not history:
        return query

    words = query.split()
    is_short = len(words) <= 8
    has_followup = bool(_FOLLOWUP_PATTERN.search(query))

    if not (is_short or has_followup):
        return query

    recent_user = [h["content"] for h in history[-6:] if h.get("role") == "user"]
    recent_assistant = [h["content"] for h in history[-4:] if h.get("role") == "assistant"]

    context_parts = []
    if len(recent_user) >= 2:
        context_parts.append(recent_user[-2])
    if recent_assistant:
        context_parts.append(recent_assistant[-1][:120])
    context_parts.append(query)
    return " ".join(context_parts)


def _keyword_hits(low: str, plain: str, keywords: tuple[str, ...]) -> bool:
    """Match either raw lowercase or diacritic-stripped (user often types without accents)."""
    for k in keywords:
        kl = k.lower()
        if kl in low:
            return True
        ks = _strip_diacritics(kl)
        if ks and ks in plain:
            return True
    return False


def _query_embedding_text(enriched_user_query: str) -> str:
    """
    Expand query text **only for embedding** (better recall). BM25 still uses the raw enriched query.
    Keep expansions short to avoid drift.
    """
    q = enriched_user_query.strip()
    if not q:
        return q
    low = q.lower()
    plain = _strip_diacritics(low)
    boost: List[str] = []
    if _keyword_hits(
        low,
        plain,
        (
            "kiến trúc",
            "microservice",
            "microservices",
            "service",
            "backend",
            "hạ tầng",
            "gateway",
            "api ",
            "cổng",
            "server",
            "hệ thống gồm",
            "luận văn",
            "đồ án",
            "pipeline",
            "faiss",
            "bm25",
            "rrf",
            "internal/refresh",
        ),
    ):
        boost.append(
            "FoxGo API Gateway Auth Ride Driver Payment Pricing Wallet Notification Review Booking User AI service cổng HTTP"
        )
    if _keyword_hits(low, plain, ("mia", "chatbot", "trợ lý", "rag", "kho tri thức", "embedding")):
        boost.append("Mia trợ lý chat RAG knowledge base AI service")
    if _keyword_hits(
        low,
        plain,
        (
            "giá",
            "cước",
            "surge",
            "pricing",
            "ước tính",
            "phí chuyến",
        ),
    ):
        boost.append("Pricing OSRM Redis surge ước tính giá")
    if _keyword_hits(
        low,
        plain,
        ("momo", "vnpay", "thanh toán online", "payment", "ví tài xế", "hoàn tiền"),
    ):
        boost.append("Payment Service MoMo VNPay ví tài xế wallet")
    if _keyword_hits(
        low,
        plain,
        ("đặt xe", "chuyến", "ride", "matching", "điều phối", "ghép tài xế"),
    ):
        boost.append("Ride Service đặt xe matching tài xế Booking Gateway")
    if _keyword_hits(
        low,
        plain,
        (
            "tài xế",
            "lái xe",
            "tôi chạy foxgo",
            "driver",
            "nhận cuốc",
            "nhận chuyến",
            "bật online",
            "bật sẵn sàng",
            "không có cuốc",
            "không nhận được cuốc",
            "thu nhập tài xế",
            "hoa hồng",
            "ví tài xế",
            "điểm uy tín",
        ),
    ):
        boost.append(
            "driver-app Driver Service ví tài xế Wallet nhận cuốc GPS online trạng thái"
        )
    if _keyword_hits(
        low,
        plain,
        (
            "khách",
            "khách hàng",
            "hành khách",
            "đi xe",
            "đặt hộ",
            "book ride",
            "customer",
        ),
    ):
        boost.append("customer-app khách đặt xe điểm đón điểm đến voucher thanh toán")
    if not boost:
        return q
    return q + "\n" + " ".join(boost)


# ─────────────────────────────────────────────────────────────────────────────
# LLM calls
# ─────────────────────────────────────────────────────────────────────────────

def _format_context(retrieved: List[Tuple[float, Chunk]]) -> str:
    parts = []
    seen = set()
    for _, chunk in retrieved:
        key = chunk.text[:80]
        if key not in seen:
            parts.append(f"[{chunk.title}]\n{chunk.text}")
            seen.add(key)
    return "\n\n---\n\n".join(parts)


async def _call_llm_claude(messages: List[dict]) -> Optional[str]:
    """Call Anthropic Claude API — most human-like responses."""
    if not ANTHROPIC_API_KEY:
        return None
    try:
        _ensure_imports()
        async with _httpx.AsyncClient(timeout=LLM_TIMEOUT_S) as client:
            resp = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key": ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": LLM_MODEL_CLAUDE,
                    "max_tokens": LLM_MAX_TOKENS,
                    "temperature": LLM_TEMPERATURE,
                    "system": SYSTEM_PROMPT,
                    "messages": messages,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["content"][0]["text"].strip()
    except Exception as exc:
        logger.warning(f"Claude API failed: {exc}")
        return None


async def _call_llm_groq(messages: List[dict]) -> Optional[str]:
    if not GROQ_API_KEY:
        return None
    try:
        _ensure_imports()
        async with _httpx.AsyncClient(timeout=LLM_TIMEOUT_S) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL_GROQ,
                    "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
                    "max_tokens": LLM_MAX_TOKENS,
                    "temperature": LLM_TEMPERATURE,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"Groq API failed: {exc}")
        return None


async def _call_llm_gemini(messages: List[dict]) -> Optional[str]:
    """Google Gemini (AI Studio API key) — often cost-effective vs Claude/OpenAI."""
    if not GEMINI_API_KEY:
        return None
    try:
        _ensure_imports()
        contents = []
        for m in messages:
            role = m.get("role", "user")
            text = m.get("content", "")
            if role == "user":
                contents.append({"role": "user", "parts": [{"text": text}]})
            elif role == "assistant":
                contents.append({"role": "model", "parts": [{"text": text}]})
        if not contents:
            return None

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{LLM_MODEL_GEMINI}:generateContent"
        )
        payload = {
            "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
            "contents": contents,
            "generationConfig": {
                "maxOutputTokens": LLM_MAX_TOKENS,
                "temperature": LLM_TEMPERATURE,
            },
            "safetySettings": [
                {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
                {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
                {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
                {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"},
            ],
        }
        async with _httpx.AsyncClient(timeout=LLM_TIMEOUT_S) as client:
            resp = await client.post(
                url,
                params={"key": GEMINI_API_KEY},
                json=payload,
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()

        cands = data.get("candidates") or []
        if not cands:
            logger.warning("Gemini returned no candidates: %s", data.get("promptFeedback", data))
            return None
        parts = cands[0].get("content", {}).get("parts") or []
        out = "".join(p.get("text", "") for p in parts).strip()
        return out or None
    except Exception as exc:
        logger.warning(f"Gemini API failed: {exc}")
        return None


async def _call_llm_openai(messages: List[dict]) -> Optional[str]:
    if not OPENAI_API_KEY:
        return None
    try:
        _ensure_imports()
        async with _httpx.AsyncClient(timeout=LLM_TIMEOUT_S) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL_OPENAI,
                    "messages": [{"role": "system", "content": SYSTEM_PROMPT}] + messages,
                    "max_tokens": LLM_MAX_TOKENS,
                    "temperature": LLM_TEMPERATURE,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"OpenAI API failed: {exc}")
        return None


def _template_answer(query: str, retrieved: List[Tuple[float, Chunk]]) -> str:
    """Last-resort answer when all LLMs fail — clean excerpt from best chunk."""
    if not retrieved:
        return (
            "Mình chưa tìm thấy thông tin về câu hỏi này trong cơ sở dữ liệu 😅\n\n"
            "Bạn thử hỏi lại theo cách khác xem sao, hoặc liên hệ mình qua:\n"
            "• Hotline: 1900-1234 (8h–22h)\n"
            "• Email: support@foxgo.vn"
        )

    def clean(text: str) -> str:
        lines = [
            l.strip() for l in text.split("\n")
            if l.strip() and not l.startswith(("TIÊU ĐỀ:", "DANH MỤC:", "---"))
        ]
        return "\n".join(lines)

    def trim(text: str, max_chars: int = 500) -> str:
        if len(text) <= max_chars:
            return text
        for delim in (".\n", ".\n\n", ". ", "\n"):
            pos = text.rfind(delim, 0, max_chars)
            if pos > max_chars // 2:
                return text[:pos + 1].strip()
        return text[:max_chars].strip() + "…"

    main = trim(clean(retrieved[0][1].text))

    extras = []
    seen = {retrieved[0][1].source}
    for score, chunk in retrieved[1:]:
        if score >= 0.40 and chunk.source not in seen:
            extra = trim(clean(chunk.text), 220)
            if extra:
                extras.append(extra)
            seen.add(chunk.source)
            break

    parts = [main] + extras
    return "\n\n".join(parts)


# ─────────────────────────────────────────────────────────────────────────────
# Answer generation
# ─────────────────────────────────────────────────────────────────────────────

async def _generate_answer(
    query: str,
    retrieved: List[Tuple[float, Chunk]],
    history: Optional[List[dict]] = None,
) -> Tuple[str, str]:
    context = _format_context(retrieved)[:MAX_CONTEXT_CHARS] if retrieved else ""

    llm_messages: List[dict] = []
    if history:
        for msg in history[-(MAX_HISTORY_TURNS * 2):]:
            role = msg.get("role", "user")
            if role in ("user", "assistant"):
                llm_messages.append({"role": role, "content": msg["content"]})

    if context:
        user_content = (
            f"NGỮ CẢNH TÌM ĐƯỢC (ưu tiên đọc từ trên xuống — đoạn đầu khớp nhất):\n{context}\n\n"
            f"CÂU HỎI HIỆN TẠI: {query}\n\n"
            "Trả lời ngay vào ý chính; không mở bài dài. Nếu nhiều mục trong ngữ cảnh mâu thuẫn, ưu tiên đoạn khớp câu hỏi nhất."
        )
    else:
        user_content = (
            f"CÂU HỎI: {query}\n\n"
            "(Lưu ý: không tìm được thông tin liên quan trong cơ sở dữ liệu — "
            "hãy thành thật nói không biết và hướng dẫn liên hệ hỗ trợ)"
        )
    llm_messages.append({"role": "user", "content": user_content})

    provider = LLM_PROVIDER.lower()

    if provider in ("claude", "auto") and ANTHROPIC_API_KEY:
        answer = await _call_llm_claude(llm_messages)
        if answer:
            return answer, "llm_claude"

    if provider in ("groq", "auto") and GROQ_API_KEY:
        answer = await _call_llm_groq(llm_messages)
        if answer:
            return answer, "llm_groq"

    if provider in ("gemini", "auto") and GEMINI_API_KEY:
        answer = await _call_llm_gemini(llm_messages)
        if answer:
            return answer, "llm_gemini"

    if provider in ("openai", "auto") and OPENAI_API_KEY:
        answer = await _call_llm_openai(llm_messages)
        if answer:
            return answer, "llm_openai"

    return _template_answer(query, retrieved), "retrieval"


# ─────────────────────────────────────────────────────────────────────────────
# Main RAG Service
# ─────────────────────────────────────────────────────────────────────────────

class RagService:
    def __init__(self):
        self._ready = False
        self._model = None
        self._index: Optional[VectorIndex] = None
        self._chunks: List[Chunk] = []
        self._init_error: Optional[str] = None
        self._rag_lock = threading.RLock()

    def _initialize_locked(self) -> bool:
        """Assume `_rag_lock` is held. First-time load of embedder + index."""
        try:
            _ensure_imports()
            t0 = time.time()

            logger.info(f"Loading embedding model: {EMBEDDING_MODEL_NAME}")
            self._model = _SentenceTransformer(EMBEDDING_MODEL_NAME)

            docs = _load_documents(KNOWLEDGE_DIR)
            if not docs:
                logger.warning("No knowledge documents found")

            self._chunks = _build_chunks(docs)

            if self._chunks:
                logger.info(f"Encoding {len(self._chunks)} chunks...")
                texts = [c.text for c in self._chunks]
                embeddings = self._model.encode(
                    texts, batch_size=32, show_progress_bar=False, normalize_embeddings=True
                )
                self._index = VectorIndex(self._chunks, embeddings)

            logger.info(f"RAG ready in {time.time() - t0:.2f}s")
            self._ready = True
            self._init_error = None
            return True

        except Exception as exc:
            self._init_error = str(exc)
            logger.error(f"RAG init failed: {exc}", exc_info=True)
            return False

    def initialize(self) -> bool:
        with self._rag_lock:
            if self._ready:
                return True
            return self._initialize_locked()

    def reload_knowledge_from_disk(self) -> dict:
        """
        Rebuild FAISS/BM25 from KNOWLEDGE_DIR (.txt). Embedding model stays in memory.
        Safe to call from a background thread. Chat requests may use the previous index
        until the swap completes.
        """
        try:
            _ensure_imports()
            with self._rag_lock:
                if self._model is None:
                    if self._ready:
                        return {"ok": False, "error": "inconsistent state: ready but no model"}
                    ok = self._initialize_locked()
                    return {
                        "ok": ok,
                        "chunks": len(self._chunks),
                        "action": "full_init",
                        "error": self._init_error,
                    }

            docs = _load_documents(KNOWLEDGE_DIR)
            chunks = _build_chunks(docs)
            if not chunks:
                with self._rag_lock:
                    self._chunks = []
                    self._index = None
                    self._ready = True
                return {"ok": True, "chunks": 0, "action": "reload"}

            model = self._model
            texts = [c.text for c in chunks]
            embeddings = model.encode(
                texts, batch_size=32, show_progress_bar=False, normalize_embeddings=True
            )
            new_index = VectorIndex(chunks, embeddings)

            with self._rag_lock:
                self._chunks = chunks
                self._index = new_index
                self._ready = True

            logger.info("RAG knowledge reloaded: %s chunks", len(chunks))
            return {"ok": True, "chunks": len(chunks), "action": "reload"}

        except Exception as exc:
            logger.error(f"RAG reload failed: {exc}", exc_info=True)
            return {"ok": False, "error": str(exc)}

    @property
    def is_ready(self) -> bool:
        return self._ready

    def get_health_snapshot(self) -> dict:
        """Non-secret diagnostics for /api/health (ops: RAG up, chunk count, key presence)."""
        with self._rag_lock:
            return {
                "ready": self._ready,
                "chunks": len(self._chunks),
                "vector_index": self._index is not None,
                "init_error": self._init_error,
            }

    async def chat(
        self,
        message: str,
        history: Optional[List[dict]] = None,
        top_k: int = TOP_K,
    ) -> dict:
        t0 = time.time()

        if not self._ready:
            if not self.initialize():
                return {
                    "answer": "Hệ thống đang khởi động, bạn thử lại sau vài giây nhé! Hoặc liên hệ support@foxgo.vn.",
                    "sources": [], "retrieval_count": 0, "score_max": 0.0,
                    "mode": "error", "latency_ms": int((time.time() - t0) * 1000),
                    "error": self._init_error,
                }

        with self._rag_lock:
            model = self._model
            index = self._index

        raw_hits: List[Tuple[float, float, Chunk]] = []
        if index is not None and message.strip() and model is not None:
            enriched_query = _enrich_query(message.strip(), history)
            embed_text = _query_embedding_text(enriched_query)
            query_emb = model.encode([embed_text], normalize_embeddings=True)
            raw_hits = index.search_hybrid(query_emb[0], enriched_query, top_k=top_k)

        if not raw_hits:
            return {
                "answer": (
                    "Mình chưa tìm thấy thông tin về vấn đề này trong hệ thống FoxGo. "
                    "Bạn vui lòng liên hệ hotline **1900-1234** (8h–22h) hoặc email "
                    "**support@foxgo.vn** để được hỗ trợ trực tiếp nhé! 🙏"
                ),
                "sources": [],
                "retrieval_count": 0,
                "score_max": 0.0,
                "mode": "no_context",
                "latency_ms": int((time.time() - t0) * 1000),
            }

        score_max = max(h[1] for h in raw_hits)
        if score_max < RAG_COSINE_ABSENT:
            return {
                "answer": (
                    "Mình chưa tìm thấy đoạn tài liệu FoxGo nào khớp đủ với câu hỏi của bạn, "
                    "nên không thể trả lời tự tin — tránh nói sai.\n\n"
                    "Bạn hãy diễn đạt thêm từ khóa (ví dụ: đặt xe, thanh toán, ví tài xế, hủy chuyến), "
                    "hoặc liên hệ **1900-1234** / **support@foxgo.vn** hoặc **driver-support@foxgo.vn** "
                    "để được hỗ trợ trực tiếp nhé."
                ),
                "sources": [],
                "retrieval_count": len(raw_hits),
                "score_max": round(float(score_max), 4),
                "mode": "no_context",
                "latency_ms": int((time.time() - t0) * 1000),
            }

        # Highest-cosine chunks first → better LLM grounding
        retrieved: List[Tuple[float, Chunk]] = sorted(
            ((h[1], h[2]) for h in raw_hits),
            key=lambda x: -x[0],
        )

        if score_max < RAG_COSINE_LLM:
            answer = _template_answer(message, retrieved)
            return {
                "answer": answer,
                "sources": list({chunk.title for _, chunk in retrieved}),
                "retrieval_count": len(retrieved),
                "score_max": round(float(score_max), 4),
                "mode": "retrieval_low_confidence",
                "latency_ms": int((time.time() - t0) * 1000),
            }

        answer, mode = await _generate_answer(message, retrieved, history=history)

        return {
            "answer": answer,
            "sources": list({chunk.title for _, chunk in retrieved}),
            "retrieval_count": len(retrieved),
            "score_max": round(float(score_max), 4),
            "mode": mode,
            "latency_ms": int((time.time() - t0) * 1000),
        }


rag_service = RagService()
