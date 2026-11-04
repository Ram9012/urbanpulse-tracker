"""
CivicPulse AI Verification Microservice
Background Worker

Runs as a continuous background task within the FastAPI process.
Periodically polls for pending verification jobs and processes them.

Worker lifecycle:
1. On startup: load all models into memory (once)
2. Every poll_interval_s: claim next pending job
3. For each claimed job: fetch images → run pipeline → save results
4. On completion: update job status, save results
5. On failure: increment retry count, mark for retry or permanent failure
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx

from app.core.config import settings
from app.core.job_queue import job_queue
from app.models.feature_extractor import feature_extractor
from app.models.segmentation import segmentation_model
from app.models.verification_engine import verification_engine

logger = logging.getLogger(__name__)

POLL_INTERVAL_S = 5  # seconds between queue polls
FETCH_TIMEOUT_S = 30  # seconds to wait when fetching images


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


async def _fetch_image_bytes(url: str, client: httpx.AsyncClient) -> Optional[bytes]:
    """
    Fetch image bytes from a URL or local file path.
    Supports:
    - http:// and https:// URLs
    - file:// paths
    - Relative paths under public/media/ (e.g. /media/evidence/pothole_before.jpg)
    """
    import os

    if url.startswith("data:"):
        # Base64 data URL — decode directly
        import base64
        try:
            _, encoded = url.split(",", 1)
            return base64.b64decode(encoded)
        except Exception as e:
            logger.error(f"Failed to decode base64 image: {e}")
            return None

    if url.startswith(("http://", "https://")):
        try:
            response = await client.get(url, timeout=FETCH_TIMEOUT_S)
            response.raise_for_status()
            return response.content
        except Exception as e:
            logger.error(f"Failed to fetch image from URL {url}: {e}")
            return None

    # Treat as filesystem path
    # Try absolute path first, then relative to project root
    candidates = [url]
    if url.startswith("/media/") or url.startswith("media/"):
        # Resolve relative to project public directory
        project_root = os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "..", "..")
        )
        candidates.append(os.path.join(project_root, "public", url.lstrip("/")))

    for path in candidates:
        if os.path.isfile(path):
            try:
                with open(path, "rb") as f:
                    return f.read()
            except Exception as e:
                logger.error(f"Failed to read file {path}: {e}")

    logger.error(f"Image not found: {url}")
    return None


async def _process_job(job: dict) -> None:
    """Process a single verification job end-to-end."""
    job_id = job["id"]
    report_id = job["report_id"]
    logger.info(f"Processing verification job {job_id} for report {report_id}")

    t_start = time.time()

    async with httpx.AsyncClient() as client:
        # Fetch both images
        original_data = await _fetch_image_bytes(job["original_image_url"], client)
        resolution_data = await _fetch_image_bytes(job["resolution_image_url"], client)

    if original_data is None:
        job_queue.fail_job(job_id, f"Could not fetch original image: {job['original_image_url']}")
        return

    if resolution_data is None:
        job_queue.fail_job(job_id, f"Could not fetch resolution image: {job['resolution_image_url']}")
        return

    # Run verification pipeline (CPU-bound — run in executor to not block event loop)
    loop = asyncio.get_event_loop()
    try:
        result_data = await asyncio.wait_for(
            loop.run_in_executor(
                None,
                lambda: verification_engine.verify(
                    original_data=original_data,
                    resolution_data=resolution_data,
                    original_filename="original.jpg",
                    resolution_filename="resolution.jpg",
                    report_category=job.get("report_category"),
                    report_description=job.get("report_description"),
                ),
            ),
            timeout=settings.job_timeout_seconds,
        )
    except asyncio.TimeoutError:
        job_queue.fail_job(job_id, f"Verification timed out after {settings.job_timeout_seconds}s")
        return
    except Exception as e:
        job_queue.fail_job(job_id, f"Verification pipeline exception: {e}")
        return

    # Build complete result record
    result_id = str(uuid.uuid4())
    scores = result_data.get("scores")
    details = result_data.get("details")

    result = {
        "id": result_id,
        "job_id": job_id,
        "report_id": report_id,
        "original_image_url": job["original_image_url"],
        "resolution_image_url": job["resolution_image_url"],
        "verification_status": (
            result_data["verification_status"].value
            if hasattr(result_data["verification_status"], "value")
            else str(result_data["verification_status"])
        ),
        "scene_consistency_score": scores.scene_consistency_score if scores else None,
        "siamese_similarity_score": scores.siamese_similarity_score if scores else None,
        "bidirectional_score": scores.bidirectional_score if scores else None,
        "segmentation_score": scores.segmentation_score if scores else None,
        "quality_score": scores.quality_score if scores else None,
        "final_verification_score": scores.final_verification_score if scores else None,
        "evidence_explanation": details.evidence_explanation if details else "",
        "flags": details.flags if details else [],
        "model_version": details.model_version if details else "unknown",
        "processing_duration_ms": result_data.get("processing_duration_ms"),
        "segmentation_ran": details.segmentation_ran if details else False,
        "is_suspected_duplicate": details.is_suspected_duplicate if details else False,
        "duplicate_hash_distance": details.duplicate_hash_distance if details else None,
        "limitations": result_data.get("limitations", []),
        "processing_pipeline": details.processing_pipeline if details else [],
        "created_at": _now_iso(),
        "report_category": job.get("report_category"),
    }

    job_queue.complete_job(job_id, result)

    total_s = time.time() - t_start
    logger.info(
        f"Job {job_id} completed: status={result['verification_status']}, "
        f"score={result['final_verification_score']}, "
        f"total_time={total_s:.2f}s"
    )


async def run_worker_loop() -> None:
    """
    Main background worker loop.
    Loads models once, then continuously polls for pending jobs.
    """
    logger.info("Starting CivicPulse AI Verification Worker...")

    # Load models once at startup
    logger.info("Loading AI models...")
    feature_extractor_ok = feature_extractor.load_model()
    if not feature_extractor_ok:
        logger.warning(
            "MobileNetV3-Small feature extractor failed to load. "
            "Siamese similarity will be unavailable. "
            "Submissions will be marked NEEDS_REVIEW."
        )

    # Segmentation is loaded lazily (only when needed)
    # Pre-load it now for faster first inference
    seg_ok = segmentation_model.load_model()
    if not seg_ok:
        logger.warning(
            "DeepLabV3 segmentation model failed to load. "
            "Segmentation will be skipped."
        )

    logger.info(
        f"Worker ready — feature_extractor={feature_extractor_ok}, "
        f"segmentation={seg_ok}. Polling every {POLL_INTERVAL_S}s"
    )

    while True:
        try:
            job = job_queue.claim_next_job()
            if job:
                await _process_job(job)
            else:
                await asyncio.sleep(POLL_INTERVAL_S)
        except Exception as e:
            logger.error(f"Worker loop error: {e}", exc_info=True)
            await asyncio.sleep(POLL_INTERVAL_S)

