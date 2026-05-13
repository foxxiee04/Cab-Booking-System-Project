"""Prediction API endpoints"""

import asyncio
import time
from typing import List
from fastapi import APIRouter, HTTPException, Header
from pydantic import BaseModel, Field
from app.schemas.prediction import (
    PredictionRequest,
    PredictionResponse,
    HealthResponse,
    RagHealthInfo,
)
from app.schemas.accept_prediction import (
    AcceptPredictionBatchRequest,
    AcceptPredictionBatchResponse,
    AcceptPredictionDriverInput,
    AcceptPredictionContext,
)
from app.schemas.wait_prediction import (
    WaitTimePredictionRequest,
    WaitTimePredictionResponse,
)
from app.schemas.chat import ChatRequest, ChatResponse
from app.services.prediction_service import prediction_service
from app.services.accept_service import accept_service
from app.services.wait_service import wait_service
from app.services.rag_service import (
    rag_service,
    ANTHROPIC_API_KEY,
    OPENAI_API_KEY,
    GROQ_API_KEY,
    GEMINI_API_KEY,
)
from app.services.ml_retrain import run_training_scripts_and_reload_models
from app.core.config import settings

router = APIRouter(prefix="/api", tags=["predictions"])


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """
    Health check endpoint
    
    Returns:
        HealthResponse with service status and RAG/LLM diagnostics (keys reported as configured/non-empty only).
    """
    snap = rag_service.get_health_snapshot()
    return HealthResponse(
        status="healthy",
        service="ai-service",
        version=settings.APP_VERSION,
        rag=RagHealthInfo(
            ready=bool(snap["ready"]),
            chunks=int(snap["chunks"]),
            vector_index=bool(snap["vector_index"]),
            init_error=snap["init_error"],
            llm_provider=snap["llm_provider_configured"],
            llm_provider_configured=snap["llm_provider_configured"],
            llm_provider_order=snap["llm_provider_order"],
            effective_llm_provider=snap["effective_llm_provider"],
            effective_llm_model=snap["effective_llm_model"],
            llm_models=snap["llm_models"],
            anthropic_key_configured=bool(ANTHROPIC_API_KEY),
            openai_key_configured=bool(OPENAI_API_KEY),
            groq_key_configured=bool(GROQ_API_KEY),
            gemini_key_configured=bool(GEMINI_API_KEY),
            query_rewrite_enabled=bool(snap["query_rewrite_enabled"]),
            query_rewrite_provider_configured=snap["query_rewrite_provider_configured"],
            query_rewrite_provider_order=snap["query_rewrite_provider_order"],
            effective_query_rewrite_provider=snap["effective_query_rewrite_provider"],
            effective_query_rewrite_model=snap["effective_query_rewrite_model"],
            reranker_enabled=bool(snap["reranker_enabled"]),
            reranker_active=bool(snap["reranker_active"]),
            reranker_load_attempted=bool(snap["reranker_load_attempted"]),
            reranker_model=snap["reranker_model"],
            embedding_model=snap["embedding_model"],
            top_k_default=int(snap["top_k_default"]),
            rerank_pool=int(snap["rerank_pool"]),
            min_faiss_prefilter=float(snap["min_faiss_prefilter"]),
            cosine_absent=float(snap["cosine_absent"]),
            cosine_llm=float(snap["cosine_llm"]),
        ),
    )


@router.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    """
    Predict ETA and price multiplier
    
    Args:
        request: PredictionRequest with:
            - distance_km: float (distance in kilometers)
            - time_of_day: str (OFF_PEAK or RUSH_HOUR)
            - day_type: str (WEEKDAY or WEEKEND)
    
    Returns:
        PredictionResponse with:
            - eta_minutes: int (estimated time of arrival in minutes)
            - price_multiplier: float (surge pricing factor)
    
    Raises:
        HTTPException: If prediction fails
    """
    try:
        # Make prediction
        predictions = prediction_service.predict(request)
        
        # Build response
        response = PredictionResponse(
            eta_minutes=predictions['eta_minutes'],
            price_multiplier=predictions['price_multiplier'],
            recommended_driver_radius_km=predictions['recommended_driver_radius_km'],
            surge_hint=predictions['surge_hint'],
            confidence_score=predictions['confidence_score'],
            reason_code=predictions['reason_code'],
            model_version=predictions['model_version'],
            feature_version=predictions['feature_version'],
            inference_ms=predictions['inference_ms'],
            distance_km=request.distance_km,
            time_of_day=request.time_of_day.value,
            day_type=request.day_type.value,
            insights=predictions['insights'],
        )
        
        return response
        
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Prediction error: {str(e)}"
        )


@router.post("/predict/accept/batch", response_model=AcceptPredictionBatchResponse)
async def predict_accept_batch(request: AcceptPredictionBatchRequest):
    """
    Batch accept probability prediction.

    Returns per-driver P(accept) predictions and a clamped multiplier [0.3, 1.2]
    that can be applied directly to dispatch scores.

    Falls back to p_accept_clamped=1.0 (neutral) if the model is not loaded.
    """
    try:
        return accept_service.predict_batch(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Accept prediction error: {exc}")


@router.post("/predict/wait-time", response_model=WaitTimePredictionResponse)
async def predict_wait_time(request: WaitTimePredictionRequest):
    """
    Predict customer wait time (minutes from booking → driver acceptance).

    Returns wait_time_minutes ∈ [1, 15] with confidence score.
    Falls back to heuristic if model is unavailable.
    """
    try:
        return wait_service.predict(request)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Wait-time prediction error: {exc}")


@router.get("/stats")
async def get_stats():
    """
    Get AI service statistics.

    Returns:
        Dictionary with service statistics
    """
    return {
        "service": "ai-service",
        "version": settings.APP_VERSION,
        "status": "running",
        "model_loaded": prediction_service.model is not None,
        "accept_model_loaded": accept_service.is_ready,
        "wait_model_loaded": wait_service.model is not None,
        "rag_ready": rag_service.is_ready,
        "model_path": settings.MODEL_PATH,
        "accept_model_path": settings.ACCEPT_MODEL_PATH,
        "wait_model_path": settings.WAIT_MODEL_PATH,
    }


class InternalRefreshBody(BaseModel):
    """Manual trigger for ops (protected by AI_INTERNAL_TOKEN)."""

    rag: bool = True
    ml: bool = False


def _require_internal_token(authorization: str | None) -> None:
    token = (settings.AI_INTERNAL_TOKEN or "").strip()
    if not token:
        raise HTTPException(status_code=404, detail="Not Found")
    if (authorization or "").strip() != f"Bearer {token}":
        raise HTTPException(status_code=403, detail="Forbidden")


@router.post("/internal/refresh")
async def internal_ai_refresh(
    body: InternalRefreshBody,
    authorization: str | None = Header(None),
):
    """
    Reload RAG index from disk and/or re-run training/*.py then hot-reload joblibs.

    Requires `Authorization: Bearer <AI_INTERNAL_TOKEN>` and non-empty `AI_INTERNAL_TOKEN`.
    """
    _require_internal_token(authorization)
    out: dict = {}
    if body.rag:
        out["rag"] = rag_service.reload_knowledge_from_disk()
    if body.ml:
        out["ml"] = await asyncio.to_thread(run_training_scripts_and_reload_models)
    return out


@router.post("/chat", response_model=ChatResponse, tags=["rag"])
async def chat(request: ChatRequest):
    """
    RAG-powered customer support chatbot.

    Uses sentence-transformer embeddings + FAISS retrieval over a Vietnamese
    knowledge base, with LLM generation prioritized as OpenAI → Gemini.

    - Default RAG_LLM_PROVIDER=auto tries OPENAI_API_KEY first, then GEMINI_API_KEY.
    - If both providers fail or no keys are configured, the service falls back to rulebase/RAG templates.
    - Set RAG_LLM_PROVIDER=none for pure retrieval-based answers.
    """
    try:
        result = await rag_service.chat(
            message=request.message,
            history=[m.model_dump() for m in request.history] if request.history else None,
            top_k=request.top_k,
        )
        return ChatResponse(**result)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Chat error: {exc}")


@router.get("/chat/status", tags=["rag"])
async def chat_status():
    """Return RAG service status and knowledge base statistics."""
    snap = rag_service.get_health_snapshot()
    return {
        "ready": snap["ready"],
        "vector_index": snap["vector_index"],
        "embedding_model": rag_service._model.__class__.__name__ if rag_service._model else None,
        "embedding_model_name": snap["embedding_model"],
        "chunks_indexed": snap["chunks"],
        "llm_provider": snap["llm_provider_configured"],
        "llm_provider_order": snap["llm_provider_order"],
        "effective_llm_provider": snap["effective_llm_provider"],
        "effective_llm_model": snap["effective_llm_model"],
        "llm_models": snap["llm_models"],
        "key_configured": snap["keys"],
        "reranker_enabled": snap["reranker_enabled"],
        "reranker_active": snap["reranker_active"],
        "reranker_load_attempted": snap["reranker_load_attempted"],
        "reranker_model": snap["reranker_model"],
        "query_rewrite_enabled": snap["query_rewrite_enabled"],
        "query_rewrite_provider_order": snap["query_rewrite_provider_order"],
        "effective_query_rewrite_provider": snap["effective_query_rewrite_provider"],
        "effective_query_rewrite_model": snap["effective_query_rewrite_model"],
    }


# ─── Unified AI Decision Endpoint ────────────────────────────────────────────

class DriverCandidate(BaseModel):
    driver_id: str
    eta_minutes: float = Field(..., ge=0)
    distance_km: float = Field(..., ge=0)
    rating: float = Field(5.0, ge=1.0, le=5.0)
    accept_rate: float = Field(0.85, ge=0.0, le=1.0)
    cancel_rate: float = Field(0.05, ge=0.0, le=1.0)
    idle_seconds: float = Field(0.0, ge=0.0)
    is_new_driver: bool = False


class RecommendDriverRequest(BaseModel):
    """
    Unified AI decision endpoint — nhận danh sách ứng viên tài xế và
    trả về xếp hạng tối ưu cùng toàn bộ lý giải AI.
    """
    distance_km: float = Field(..., ge=0.1, description="Quãng đường chuyến (km)")
    fare_estimate: float = Field(..., ge=0, description="Giá ước tính (VND)")
    surge_multiplier: float = Field(1.0, ge=1.0, le=3.0)
    time_of_day: str = Field("OFF_PEAK", description="OFF_PEAK | RUSH_HOUR")
    day_type: str = Field("WEEKDAY", description="WEEKDAY | WEEKEND")
    hour_of_day: int = Field(8, ge=0, le=23)
    pickup_zone: str = Field("B", description="A (trung tâm) | B (nội thành) | C (ngoại thành)")
    demand_level: str = Field("MEDIUM", description="LOW | MEDIUM | HIGH")
    available_driver_count: int = Field(5, ge=0)
    candidates: List[DriverCandidate]


class RankedDriver(BaseModel):
    driver_id: str
    rank: int
    final_score: float
    p_accept: float
    p_accept_clamped: float
    ai_confidence: float
    score_breakdown: dict
    recommendation_reason: str


class RecommendDriverResponse(BaseModel):
    ranked_drivers: List[RankedDriver]
    surge_prediction: dict
    wait_time_prediction: dict
    demand_level: str
    ai_pipeline_summary: dict
    inference_ms: int


def _score_driver(
    candidate: DriverCandidate,
    p_accept_clamped: float,
    ai_adjustment: float,
) -> tuple[float, dict]:
    """
    Scoring công thức (khớp với api-gateway/driver-matcher.ts):
    score = (0.40×eta + 0.20×rating + 0.15×accept - 0.15×cancel
             + 0.05×idle + 0.05×priority + aiAdjust) × pAccept
    """
    max_eta = 30.0
    eta_score = max(0.0, 1.0 - candidate.eta_minutes / max_eta)
    rating_score = (candidate.rating - 1.0) / 4.0
    idle_score = min(candidate.idle_seconds / 7200.0, 1.0)
    new_driver_boost = 0.35 if candidate.is_new_driver else 0.0
    priority = min(1.0, new_driver_boost + idle_score * 0.45 - candidate.cancel_rate * 0.25)

    base = (
        0.40 * eta_score
        + 0.20 * rating_score
        + 0.15 * candidate.accept_rate
        - 0.15 * candidate.cancel_rate
        + 0.05 * idle_score
        + 0.05 * priority
        + ai_adjustment
    )
    final = base * p_accept_clamped

    breakdown = {
        "eta_score": round(eta_score, 3),
        "rating_score": round(rating_score, 3),
        "idle_score": round(idle_score, 3),
        "accept_rate": round(candidate.accept_rate, 3),
        "cancel_rate": round(candidate.cancel_rate, 3),
        "priority": round(priority, 3),
        "ai_adjustment": round(ai_adjustment, 3),
        "base_score": round(base, 4),
        "p_accept_clamped": round(p_accept_clamped, 3),
        "final_score": round(final, 4),
    }
    return final, breakdown


def _make_reason(candidate: DriverCandidate, rank: int, p_accept: float) -> str:
    reasons = []
    if rank == 1:
        reasons.append("điểm tổng hợp cao nhất")
    if candidate.eta_minutes <= 3:
        reasons.append(f"ETA rất gần ({candidate.eta_minutes:.0f} phút)")
    elif candidate.eta_minutes <= 6:
        reasons.append(f"ETA tốt ({candidate.eta_minutes:.0f} phút)")
    if candidate.rating >= 4.8:
        reasons.append(f"đánh giá xuất sắc ({candidate.rating:.1f}★)")
    if candidate.accept_rate >= 0.90:
        reasons.append(f"tỷ lệ chấp nhận cao ({candidate.accept_rate*100:.0f}%)")
    if candidate.is_new_driver:
        reasons.append("tài xế mới được ưu tiên")
    if p_accept >= 0.80:
        reasons.append(f"AI dự đoán sẽ nhận cuốc ({p_accept*100:.0f}%)")
    return " · ".join(reasons) if reasons else "đáp ứng điều kiện tối thiểu"


@router.post("/recommend-driver", response_model=RecommendDriverResponse, tags=["ai-decision"])
async def recommend_driver(request: RecommendDriverRequest):
    """
    **Unified AI Decision Endpoint** — Xếp hạng tài xế tối ưu dựa trên toàn bộ pipeline AI.

    Pipeline:
    1. ETA & Surge prediction (RandomForest)
    2. Accept probability per driver (GradientBoosting, 15 features)
    3. Wait-time prediction (GradientBoosting, 12 features)
    4. Scoring tổng hợp = base_score × p_accept_clamped

    Trả về danh sách tài xế đã xếp hạng cùng lý giải chi tiết từng thành phần AI.
    """
    t0 = time.time()

    if not request.candidates:
        raise HTTPException(status_code=400, detail="candidates list is empty")

    # ── 1. ETA + Surge prediction ─────────────────────────────────────────────
    from app.schemas.prediction import TimeOfDay, DayType
    try:
        tod = TimeOfDay(request.time_of_day)
        dt = DayType(request.day_type)
    except Exception:
        tod = TimeOfDay.OFF_PEAK
        dt = DayType.WEEKDAY

    pred_req = PredictionRequest(
        distance_km=request.distance_km,
        time_of_day=tod,
        day_type=dt,
    )
    try:
        surge_pred = prediction_service.predict(pred_req)
    except Exception:
        surge_pred = {
            "surge_hint": request.surge_multiplier,
            "price_multiplier": request.surge_multiplier,
            "eta_minutes": int(request.distance_km / 25 * 60),
            "confidence_score": 0.5,
            "insights": {"demand_level": request.demand_level, "surge_reason": "fallback"},
            "reason_code": "AI_FALLBACK",
        }

    # ── 2. Accept probability batch ───────────────────────────────────────────
    context = AcceptPredictionContext(
        distance_km=request.distance_km,
        fare_estimate=request.fare_estimate,
        surge_multiplier=request.surge_multiplier,
        hour_of_day=request.hour_of_day,
        pickup_zone=request.pickup_zone,
        demand_level=request.demand_level,
        available_driver_count=request.available_driver_count,
    )
    driver_inputs = [
        AcceptPredictionDriverInput(
            driver_id=c.driver_id,
            eta_minutes=c.eta_minutes,
            driver_accept_rate=c.accept_rate,
            driver_cancel_rate=c.cancel_rate,
        )
        for c in request.candidates
    ]
    accept_req = AcceptPredictionBatchRequest(context=context, drivers=driver_inputs)
    try:
        accept_resp = accept_service.predict_batch(accept_req)
        accept_map = {r.driver_id: r for r in accept_resp.results}
    except Exception:
        accept_map = {}

    # ── 3. Wait-time prediction ───────────────────────────────────────────────
    demand_ord = {"LOW": 0, "MEDIUM": 1, "HIGH": 2}.get(request.demand_level, 1)
    wait_req = WaitTimePredictionRequest(
        demand_level=request.demand_level,
        active_booking_count=max(1, request.available_driver_count),
        available_driver_count=request.available_driver_count,
        hour_of_day=request.hour_of_day,
        day_of_week=0,
        pickup_zone=request.pickup_zone,
        surge_multiplier=request.surge_multiplier,
        avg_accept_rate=sum(c.accept_rate for c in request.candidates) / max(1, len(request.candidates)),
        historical_wait_p50=4.0,
    )
    try:
        wait_pred = wait_service.predict(wait_req)
        wait_result = {"wait_time_minutes": wait_pred.wait_time_minutes, "confidence": wait_pred.confidence}
    except Exception:
        wait_result = {"wait_time_minutes": 4.0, "confidence": 0.4}

    # ── 4. Score & rank ───────────────────────────────────────────────────────
    scored = []
    for c in request.candidates:
        ar = accept_map.get(c.driver_id)
        p_accept = ar.p_accept if ar else 0.7
        p_accept_clamped = ar.p_accept_clamped if ar else 1.0
        confidence = ar.confidence if ar else 0.5
        ai_adj = min(0.08, max(-0.08, (p_accept - 0.5) * 0.16))
        final_score, breakdown = _score_driver(c, p_accept_clamped, ai_adj)
        scored.append((final_score, p_accept, p_accept_clamped, confidence, breakdown, c))

    scored.sort(key=lambda x: x[0], reverse=True)

    ranked = []
    for rank, (final_score, p_accept, p_accept_clamped, confidence, breakdown, c) in enumerate(scored, 1):
        ranked.append(RankedDriver(
            driver_id=c.driver_id,
            rank=rank,
            final_score=round(final_score, 4),
            p_accept=round(p_accept, 3),
            p_accept_clamped=round(p_accept_clamped, 3),
            ai_confidence=round(confidence, 3),
            score_breakdown=breakdown,
            recommendation_reason=_make_reason(c, rank, p_accept),
        ))

    elapsed_ms = int((time.time() - t0) * 1000)

    return RecommendDriverResponse(
        ranked_drivers=ranked,
        surge_prediction={
            "surge_hint": surge_pred.get("surge_hint", request.surge_multiplier),
            "price_multiplier": surge_pred.get("price_multiplier", request.surge_multiplier),
            "confidence_score": surge_pred.get("confidence_score", 0.5),
            "demand_level": surge_pred.get("insights", {}).get("demand_level", request.demand_level),
            "surge_reason": surge_pred.get("insights", {}).get("surge_reason", ""),
            "reason_code": surge_pred.get("reason_code", "RULE_ENGINE"),
        },
        wait_time_prediction=wait_result,
        demand_level=request.demand_level,
        ai_pipeline_summary={
            "models_used": ["eta-rf-v2", "accept-gbm-v1", "wait-gbm-v1"],
            "candidates_evaluated": len(request.candidates),
            "accept_model_active": accept_service.is_ready,
            "wait_model_active": wait_service.model is not None,
            "surge_model_active": prediction_service.model is not None,
            "scoring_formula": "score = (0.40×eta + 0.20×rating + 0.15×accept - 0.15×cancel + 0.05×idle + 0.05×priority + aiAdj) × pAccept",
            "inference_ms": elapsed_ms,
        },
        inference_ms=elapsed_ms,
    )
