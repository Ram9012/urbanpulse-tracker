"""
CivicPulse AI Verification Microservice
FastAPI Application Entry Point
"""

import asyncio
import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.worker import run_worker_loop
from app.api.verification import router as verification_router

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

_startup_time = time.time()
_worker_task = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: start background worker on startup."""
    global _worker_task
    logger.info(f"Starting {settings.service_name} v{settings.service_version}")
    _worker_task = asyncio.create_task(run_worker_loop())
    yield
    # Shutdown: cancel worker
    if _worker_task and not _worker_task.done():
        _worker_task.cancel()
        try:
            await _worker_task
        except asyncio.CancelledError:
            pass
    logger.info("AI Verification Service shutdown complete.")


app = FastAPI(
    title=settings.service_name,
    version=settings.service_version,
    description=(
        "AI-powered bidirectional resolution verification microservice for CivicPulse. "
        "Uses MobileNetV3-Small feature extraction, ORB-based bidirectional correspondence, "
        "and conditional DeepLabV3 semantic segmentation."
    ),
    lifespan=lifespan,
)

# CORS — only allow requests from the CivicPulse backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"],
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

# Include verification router
app.include_router(verification_router)


@app.get("/health")
async def health():
    """Health check endpoint."""
    from app.models.feature_extractor import feature_extractor
    from app.models.segmentation import segmentation_model

    uptime = time.time() - _startup_time
    return JSONResponse({
        "status": "healthy",
        "service": settings.service_name,
        "version": settings.service_version,
        "models_loaded": {
            "feature_extractor": feature_extractor.is_loaded,
            "segmentation": segmentation_model.is_loaded,
        },
        "device": "cpu",
        "uptime_seconds": round(uptime, 1),
    })


@app.get("/")
async def root():
    return {"service": settings.service_name, "version": settings.service_version, "status": "running"}

