"""Knowledge base + RAG helper tests (không cần tải SentenceTransformer)."""

from app.services.rag_service import (
    KNOWLEDGE_DIR,
    _build_chunks,
    _expand_quick_menu_label,
    _format_user_facing_answer,
    _load_documents,
    _query_embedding_text,
    _try_smalltalk,
)


def test_roleplay_knowledge_files_exist():
    names = {p.name for p in KNOWLEDGE_DIR.glob("*.txt")}
    assert "16_customer_roleplay_scenarios.txt" in names
    assert "17_driver_roleplay_scenarios.txt" in names
    assert "18_foxgo_project_reference_deep.txt" in names


def test_corpus_chunk_count_health():
    docs = _load_documents(KNOWLEDGE_DIR)
    chunks = _build_chunks(docs)
    assert len(chunks) >= 180


def test_query_embedding_boosts_driver_role():
    s = _query_embedding_text("toi la tai xe khong nhan duoc cuoc ban dem")
    assert "driver-app" in s


def test_query_embedding_boosts_customer_keywords():
    s = _query_embedding_text("mình là khách cần support voucher")
    assert "customer-app" in s


def test_query_embedding_boosts_thesis_architecture():
    s = _query_embedding_text("luận văn mô tả kiến trúc microservice FAISS RRF")
    assert "FoxGo API Gateway" in s


def test_smalltalk_greeting_skips_retrieval():
    r = _try_smalltalk("hi")
    assert r is not None
    assert r["mode"] == "smalltalk_greeting"
    assert "Mia" in r["answer"]


def test_smalltalk_identity():
    r = _try_smalltalk("bạn là ai")
    assert r is not None
    assert r["mode"] == "smalltalk_identity"


def test_expand_quick_menu_voucher_label():
    expanded = _expand_quick_menu_label("Voucher & ưu đãi")
    assert "voucher" in expanded.lower()
    assert expanded != "Voucher & ưu đãi"


def test_format_user_facing_strips_markdown_bold():
    assert _format_user_facing_answer("Gọi **1900-1234** nhé.") == "Gọi 1900-1234 nhé."
    assert "**" not in _format_user_facing_answer("A **B** C **D**")
