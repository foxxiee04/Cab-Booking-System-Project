"""Knowledge base + RAG helper tests (không cần tải SentenceTransformer)."""

from app.services.rag_service import (
    KNOWLEDGE_DIR,
    _build_chunks,
    _load_documents,
    _query_embedding_text,
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
