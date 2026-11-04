"""
CivicPulse AI Verification Microservice
Background Job Queue — Database-backed (JSON flat-file)

Lightweight job queue without Redis/Celery/Kafka.
Uses file-based locking + atomic JSON updates.

Job lifecycle:
  PENDING → PROCESSING → COMPLETED
                       ↘ FAILED → RETRY_PENDING → PROCESSING → ...

Idempotency: duplicate jobs for the same (report_id, res_image_hash)
are detected and rejected before insertion.
"""

import json
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, List, Dict, Any

# fcntl is POSIX-only; msvcrt is the Windows equivalent for file locking.
# This service must be able to at least import and run on Windows dev
# machines, not just Linux production hosts.
if sys.platform == "win32":
    import msvcrt
else:
    import fcntl

from app.core.config import settings

logger = logging.getLogger(__name__)

# Ensure data directory exists
Path(settings.jobs_file).parent.mkdir(parents=True, exist_ok=True)
Path(settings.results_file).parent.mkdir(parents=True, exist_ok=True)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_json(filepath: str, default: Any) -> Any:
    try:
        if os.path.exists(filepath):
            with open(filepath, "r") as f:
                return json.load(f)
    except Exception as e:
        logger.warning(f"Failed to load {filepath}: {e}")
    return default


def _save_json(filepath: str, data: Any) -> bool:
    try:
        tmp = filepath + ".tmp"
        with open(tmp, "w") as f:
            json.dump(data, f, indent=2)
        os.replace(tmp, filepath)  # atomic rename
        return True
    except Exception as e:
        logger.error(f"Failed to save {filepath}: {e}")
        return False


def _with_lock(filepath: str):
    """Context manager for file-based advisory locking (cross-platform)."""
    import contextlib

    @contextlib.contextmanager
    def _lock():
        lock_path = filepath + ".lock"
        with open(lock_path, "w") as lock_file:
            try:
                if sys.platform == "win32":
                    # msvcrt.locking requires a non-zero byte count; lock a
                    # single byte of the lock file as an advisory mutex.
                    lock_file.seek(0)
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_LOCK, 1)
                else:
                    fcntl.flock(lock_file, fcntl.LOCK_EX)
                yield
            finally:
                if sys.platform == "win32":
                    lock_file.seek(0)
                    msvcrt.locking(lock_file.fileno(), msvcrt.LK_UNLCK, 1)
                else:
                    fcntl.flock(lock_file, fcntl.LOCK_UN)

    return _lock()


class JobQueue:
    """
    File-backed verification job queue.
    Thread-safe via advisory file locks.
    """

    def create_job(
        self,
        report_id: str,
        original_image_url: str,
        resolution_image_url: str,
        report_category: Optional[str] = None,
        report_description: Optional[str] = None,
        submitted_by: Optional[str] = None,
        image_hash: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Create a new verification job.
        Returns the job dict. Raises ValueError if duplicate job exists.
        """
        with _with_lock(settings.jobs_file):
            jobs = _load_json(settings.jobs_file, [])

            # Idempotency: check for existing pending/processing job
            for job in jobs:
                if (
                    job["report_id"] == report_id
                    and job["job_status"] in ("pending", "processing", "retry_pending")
                ):
                    logger.info(
                        f"Duplicate job rejected for report {report_id} "
                        f"(existing job {job['id']})"
                    )
                    return job  # Return existing job instead of creating duplicate

                # Hash-based duplicate detection
                if image_hash and job.get("image_hash") == image_hash:
                    if job["job_status"] in ("completed",):
                        logger.info(
                            f"Same image already verified (hash match), "
                            f"returning existing completed job {job['id']}"
                        )
                        return job

            job = {
                "id": str(uuid.uuid4()),
                "report_id": report_id,
                "original_image_url": original_image_url,
                "resolution_image_url": resolution_image_url,
                "report_category": report_category,
                "report_description": report_description,
                "submitted_by": submitted_by,
                "image_hash": image_hash,
                "job_status": "pending",
                "retry_count": 0,
                "last_error": None,
                "created_at": _now_iso(),
                "started_at": None,
                "completed_at": None,
            }
            jobs.append(job)
            _save_json(settings.jobs_file, jobs)
            logger.info(f"Created verification job {job['id']} for report {report_id}")
            return job

    def claim_next_job(self) -> Optional[Dict[str, Any]]:
        """
        Atomically claim the next pending job for processing.
        Returns the claimed job or None if no jobs available.
        """
        with _with_lock(settings.jobs_file):
            jobs = _load_json(settings.jobs_file, [])
            now = _now_iso()

            for job in jobs:
                if job["job_status"] in ("pending", "retry_pending"):
                    if job["retry_count"] >= settings.max_retries:
                        job["job_status"] = "failed"
                        job["last_error"] = f"Max retries ({settings.max_retries}) exceeded"
                        continue

                    job["job_status"] = "processing"
                    job["started_at"] = now
                    _save_json(settings.jobs_file, jobs)
                    logger.info(f"Claimed job {job['id']} for processing")
                    return job

        return None

    def complete_job(self, job_id: str, result: Dict[str, Any]) -> bool:
        """Mark a job as completed and save verification results."""
        with _with_lock(settings.jobs_file):
            jobs = _load_json(settings.jobs_file, [])
            for job in jobs:
                if job["id"] == job_id:
                    job["job_status"] = "completed"
                    job["completed_at"] = _now_iso()
                    job["result_id"] = result.get("id")
                    _save_json(settings.jobs_file, jobs)
                    break

        # Save result separately
        results = _load_json(settings.results_file, [])
        results.append(result)
        return _save_json(settings.results_file, results)

    def fail_job(self, job_id: str, error: str) -> bool:
        """Mark a job as failed, increment retry count."""
        with _with_lock(settings.jobs_file):
            jobs = _load_json(settings.jobs_file, [])
            for job in jobs:
                if job["id"] == job_id:
                    job["retry_count"] = job.get("retry_count", 0) + 1
                    job["last_error"] = error
                    if job["retry_count"] >= settings.max_retries:
                        job["job_status"] = "failed"
                        logger.error(f"Job {job_id} permanently failed after {job['retry_count']} retries")
                    else:
                        job["job_status"] = "retry_pending"
                        logger.warning(
                            f"Job {job_id} failed (attempt {job['retry_count']}), "
                            f"will retry. Error: {error}"
                        )
                    return _save_json(settings.jobs_file, jobs)
        return False

    def get_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get a job by ID."""
        jobs = _load_json(settings.jobs_file, [])
        return next((j for j in jobs if j["id"] == job_id), None)

    def get_jobs_for_report(self, report_id: str) -> List[Dict[str, Any]]:
        """Get all jobs for a report, sorted newest first."""
        jobs = _load_json(settings.jobs_file, [])
        report_jobs = [j for j in jobs if j["report_id"] == report_id]
        return sorted(report_jobs, key=lambda j: j["created_at"], reverse=True)

    def get_result(self, result_id: str) -> Optional[Dict[str, Any]]:
        """Get a verification result by ID."""
        results = _load_json(settings.results_file, [])
        return next((r for r in results if r.get("id") == result_id), None)

    def get_results_for_report(self, report_id: str) -> List[Dict[str, Any]]:
        """Get all verification results for a report, newest first."""
        results = _load_json(settings.results_file, [])
        report_results = [r for r in results if r.get("report_id") == report_id]
        return sorted(report_results, key=lambda r: r.get("created_at", ""), reverse=True)

    def list_pending_jobs(self) -> List[Dict[str, Any]]:
        """List all pending and retry-pending jobs."""
        jobs = _load_json(settings.jobs_file, [])
        return [j for j in jobs if j["job_status"] in ("pending", "retry_pending")]


# Module-level singleton
job_queue = JobQueue()

