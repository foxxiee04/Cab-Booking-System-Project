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
     e. Generate a natural, human-like answer via LLM (Claude → Groq → OpenAI → template).
"""

import logging
import os
import re
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
TOP_K = 7
MIN_SCORE = 0.35          # Lower than before — hybrid search compensates for false negatives
MAX_CONTEXT_CHARS = 4000  # Wider context window for LLM

# LLM provider priority: claude → groq → openai → template
LLM_PROVIDER = os.getenv("RAG_LLM_PROVIDER", "auto")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
LLM_MODEL_CLAUDE = os.getenv("RAG_LLM_MODEL_CLAUDE", "claude-haiku-4-5-20251001")
LLM_MODEL_GROQ = os.getenv("RAG_LLM_MODEL", "llama3-8b-8192")
LLM_MODEL_OPENAI = os.getenv("RAG_LLM_MODEL_OPENAI", "gpt-3.5-turbo")
LLM_TIMEOUT_S = float(os.getenv("RAG_LLM_TIMEOUT_S", "10"))
MAX_HISTORY_TURNS = 8

# ─────────────────────────────────────────────────────────────────────────────
# System prompt — Mia persona
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """Bạn là Mia — trợ lý hỗ trợ thông minh của FoxGo, ứng dụng gọi xe công nghệ tại Việt Nam.

QUY TẮC BẮT BUỘC (không được vi phạm):
1. CHỈ trả lời dựa trên thông tin trong phần [NGỮ CẢNH] bên dưới.
2. KHÔNG được bịa thêm số liệu, chính sách, giá cước, hoặc bất kỳ thông tin nào không có trong [NGỮ CẢNH].
3. Nếu [NGỮ CẢNH] KHÔNG có thông tin để trả lời → nói chính xác: "Mình chưa có thông tin chính xác về vấn đề này. Bạn liên hệ hotline 1900-1234 hoặc email support@foxgo.vn để được hỗ trợ trực tiếp nhé! 🙏"
4. KHÔNG suy luận, KHÔNG giả định, KHÔNG dùng kiến thức bên ngoài FoxGo.

Phong cách giao tiếp:
- Thân thiện, ấm áp, gần gũi — xưng "mình" với người dùng là "bạn"
- Nếu người dùng đang bực bội hoặc gặp sự cố khó chịu → thể hiện đồng cảm trước ("Ôi, tình huống đó nghe khó chịu thiệt!"), rồi mới hướng dẫn
- Câu trả lời ngắn gọn (≤ 120 từ) trừ khi cần hướng dẫn nhiều bước
- Khi hướng dẫn nhiều bước → dùng số thứ tự (1, 2, 3...) cho dễ làm theo
- Thỉnh thoảng dùng emoji nhẹ nhàng (1–2 cái) — không lạm dụng
- Đọc ngữ cảnh hội thoại — không lặp lại những gì đã giải thích trước đó
- Nếu câu hỏi mơ hồ → hỏi lại một câu ngắn để hiểu đúng ý ("Bạn đang dùng app khách hay app tài xế vậy?")

Nhận biết ngữ cảnh người dùng:
- Tài xế: hỏi về thu nhập, hoa hồng, chuyến, online/offline, ví driver, nạp/rút tiền, đăng ký tài xế
- Khách hàng: hỏi về đặt xe, theo dõi, hủy chuyến, thanh toán, hoàn tiền, voucher
- Điều chỉnh cách giải thích phù hợp với từng đối tượng

Thông tin liên hệ hỗ trợ:
- Hotline: 1900-1234 (8h–22h hàng ngày)
- Email: support@foxgo.vn"""


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
                if idx >= 0 and float(score) >= MIN_SCORE * 0.7:
                    ranks[int(idx)] = 1.0 / (60 + rank)
        else:
            sims = (self.embeddings @ q.T).flatten()
            top = np.argsort(sims)[::-1][:k]
            for rank, idx in enumerate(top):
                if float(sims[idx]) >= MIN_SCORE * 0.7:
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
    ) -> List[Tuple[float, Chunk]]:
        """
        Reciprocal Rank Fusion of semantic (FAISS) + keyword (BM25) results.
        Falls back to semantic-only if BM25 is unavailable.
        """
        k_inner = min(top_k * 3, self.n)

        semantic = self._semantic_ranks(query_embedding, k_inner)
        bm25 = self._bm25_ranks(query_text, k_inner)

        all_indices = set(semantic.keys()) | set(bm25.keys())
        if not all_indices:
            return []

        rrf = {i: semantic.get(i, 0.0) + bm25.get(i, 0.0) for i in all_indices}
        top_indices = sorted(rrf.keys(), key=lambda i: -rrf[i])[:top_k]
        return [(rrf[i], self.chunks[i]) for i in top_indices]

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
                if idx >= 0 and float(score) >= MIN_SCORE
            ]
        else:
            sims = (self.embeddings @ q.T).flatten()
            top = _np.argsort(sims)[::-1][:top_k]
            return [
                (float(sims[i]), self.chunks[i])
                for i in top
                if float(sims[i]) >= MIN_SCORE
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
                    "max_tokens": 512,
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


async def _call_llm_groq(context: str, messages: List[dict]) -> Optional[str]:
    if not GROQ_API_KEY:
        return None
    try:
        _ensure_imports()
        system = f"{SYSTEM_PROMPT}\n\nNGỮ CẢNH:\n{context}"
        async with _httpx.AsyncClient(timeout=LLM_TIMEOUT_S) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL_GROQ,
                    "messages": [{"role": "system", "content": system}] + messages,
                    "max_tokens": 512,
                    "temperature": 0.4,
                },
            )
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"Groq API failed: {exc}")
        return None


async def _call_llm_openai(context: str, messages: List[dict]) -> Optional[str]:
    if not OPENAI_API_KEY:
        return None
    try:
        _ensure_imports()
        system = f"{SYSTEM_PROMPT}\n\nNGỮ CẢNH:\n{context}"
        async with _httpx.AsyncClient(timeout=LLM_TIMEOUT_S) as client:
            resp = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {OPENAI_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": LLM_MODEL_OPENAI,
                    "messages": [{"role": "system", "content": system}] + messages,
                    "max_tokens": 512,
                    "temperature": 0.4,
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
            f"NGỮ CẢNH TÌM ĐƯỢC:\n{context}\n\n"
            f"CÂU HỎI: {query}"
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
        answer = await _call_llm_groq(context, llm_messages[:-1] + [{"role": "user", "content": query}])
        if answer:
            return answer, "llm_groq"

    if provider in ("openai", "auto") and OPENAI_API_KEY:
        answer = await _call_llm_openai(context, llm_messages[:-1] + [{"role": "user", "content": query}])
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

    def initialize(self) -> bool:
        if self._ready:
            return True
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
            return True

        except Exception as exc:
            self._init_error = str(exc)
            logger.error(f"RAG init failed: {exc}", exc_info=True)
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
        t0 = time.time()

        if not self._ready:
            if not self.initialize():
                return {
                    "answer": "Hệ thống đang khởi động, bạn thử lại sau vài giây nhé! Hoặc liên hệ support@foxgo.vn.",
                    "sources": [], "retrieval_count": 0, "score_max": 0.0,
                    "mode": "error", "latency_ms": int((time.time() - t0) * 1000),
                    "error": self._init_error,
                }

        retrieved: List[Tuple[float, Chunk]] = []
        if self._index is not None and message.strip():
            enriched_query = _enrich_query(message.strip(), history)
            query_emb = self._model.encode([enriched_query], normalize_embeddings=True)
            retrieved = self._index.search_hybrid(query_emb[0], enriched_query, top_k=top_k)

        if not retrieved:
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

        score_max = max((s for s, _ in retrieved), default=0.0)
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
