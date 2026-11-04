"""
CivicPulse AI Verification Microservice
FastAPI Routes — Verification API
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Header, Body
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.job_queue import job_queue
from app.core.schemas import (
    VerificationSubmitRequest,
    VerificationJobResponse,
    ProcessingStatus,
    VerificationStatus,
    ScoreBreakdown,
    VerificationDetails,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/verification", tags=["verification"])


def _verify_service_token(x_service_token: Optional[str]) -> None:
    """Validate internal service-to-service authentication token."""
    if x_service_token != settings.api_secret_key:
        raise HTTPException(status_code=401, detail="Invalid or missing service token")


def _job_to_response(job: dict) -> dict:
    """Convert a raw job dict to API response format."""
    result_id = job.get("result_id")
    result = None
    if result_id:
        result = job_queue.get_result(result_id)

    scores = None
    details = None
    verification_status = None

    if result:
        verification_status = result.get("verification_status")
        scores = ScoreBreakdown(
            scene_consistency_score=result.get("scene_consistency_score"),
            siamese_similarity_score=result.get("siamese_similarity_score"),
            bidirectional_score=result.get("bidirectional_score"),
            segmentation_score=result.get("segmentation_score"),
            quality_score=result.get("quality_score"),
            final_verification_score=result.get("final_verification_score"),
        )
        details = VerificationDetails(
            segmentation_ran=result.get("segmentation_ran", False),
            duplicate_hash_distance=result.get("duplicate_hash_distance"),
            is_suspected_duplicate=result.get("is_suspected_duplicate", False),
            model_version=result.get("model_version", "unknown"),
            processing_pipeline=result.get("processing_pipeline", []),
            evidence_explanation=result.get("evidence_explanation", ""),
            flags=result.get("flags", []),
        )

    # Map job_status to ProcessingStatus
    status_map = {
        "pending": ProcessingStatus.PENDING,
        "processing": ProcessingStatus.PROCESSING,
        "completed": ProcessingStatus.COMPLETED,
        "failed": ProcessingStatus.FAILED,
        "retry_pending": ProcessingStatus.PENDING,
    }
    processing_status = status_map.get(job.get("job_status", "pending"), ProcessingStatus.PENDING)

    return {
        "job_id": job["id"],
        "report_id": job["report_id"],
        "processing_status": processing_status,
        "verification_status": verification_status,
        "scores": scores,
        "details": details,
        "original_image_url": job.get("original_image_url"),
        "resolution_image_url": job.get("resolution_image_url"),
        "created_at": job.get("created_at", ""),
        "updated_at": job.get("completed_at") or job.get("started_at") or job.get("created_at", ""),
        "processing_duration_ms": result.get("processing_duration_ms") if result else None,
        "error_message": job.get("last_error"),
    }


@router.post("/submit", response_model=VerificationJobResponse, status_code=202)
async def submit_verification(
    request: VerificationSubmitRequest,
    x_service_token: Optional[str] = Header(None),
):
    """
    Submit a resolution verification job.
    Called by the CivicPulse backend after a field worker uploads a resolution photo.
    Returns immediately — verification runs in background.
    """
    _verify_service_token(x_service_token)

    try:
        job = job_queue.create_job(
            report_id=request.report_id,
            original_image_url=request.original_image_url,
            resolution_image_url=request.resolution_image_url,
            report_category=request.report_category,
            report_description=request.report_description,
            submitted_by=request.submitted_by,
        )
        return _job_to_response(job)
    except Exception as e:
        logger.error(f"Failed to create verification job: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create verification job: {e}")


@router.get("/{job_id}", response_model=VerificationJobResponse)
async def get_verification(
    job_id: str,
    x_service_token: Optional[str] = Header(None),
):
    """Get verification status and results by job ID."""
    _verify_service_token(x_service_token)

    job = job_queue.get_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail=f"Verification job {job_id} not found")

    return _job_to_response(job)


@router.get("/report/{report_id}")
async def get_verifications_for_report(
    report_id: str,
    x_service_token: Optional[str] = Header(None),
):
    """Get all verification jobs and results for a report."""
    _verify_service_token(x_service_token)

    jobs = job_queue.get_jobs_for_report(report_id)
    results = job_queue.get_results_for_report(report_id)

    return {
        "report_id": report_id,
        "total_verifications": len(jobs),
        "jobs": [_job_to_response(j) for j in jobs],
        "latest_result": results[0] if results else None,
    }

