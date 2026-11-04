"""
CivicPulse AI Verification Microservice
Pydantic request/response schemas
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from enum import Enum


class VerificationStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    VERIFIED = "VERIFIED"
    NEEDS_REVIEW = "NEEDS_REVIEW"
    INSUFFICIENT_EVIDENCE = "INSUFFICIENT_EVIDENCE"
    FAILED = "failed"


class ProcessingStatus(str, Enum):
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class VerificationSubmitRequest(BaseModel):
    report_id: str = Field(..., description="CivicPulse report ID (e.g. CIV-95674)")
    original_image_url: str = Field(..., description="URL or file path to original citizen image")
    resolution_image_url: str = Field(..., description="URL or file path to resolution image")
    report_category: Optional[str] = Field(None, description="Report category")
    report_description: Optional[str] = Field(None, description="Original report description text")
    submitted_by: Optional[str] = Field(None, description="Username who submitted the resolution")


class ScoreBreakdown(BaseModel):
    scene_consistency_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    siamese_similarity_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    bidirectional_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    segmentation_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    quality_score: Optional[float] = Field(None, ge=0.0, le=1.0)
    final_verification_score: Optional[float] = Field(None, ge=0.0, le=1.0)


class VerificationDetails(BaseModel):
    original_image_quality: Optional[str] = None
    resolution_image_quality: Optional[str] = None
    orb_matches_count: Optional[int] = None
    orb_good_matches_count: Optional[int] = None
    feature_correspondence_ratio: Optional[float] = None
    segmentation_ran: bool = False
    segmentation_damage_area_before: Optional[float] = None
    segmentation_damage_area_after: Optional[float] = None
    duplicate_hash_distance: Optional[int] = None
    is_suspected_duplicate: bool = False
    model_version: str = "mobilenet_v3_small_imagenet_pretrained"
    processing_pipeline: List[str] = []
    evidence_explanation: str = ""
    flags: List[str] = []


class VerificationJobResponse(BaseModel):
    job_id: str
    report_id: str
    processing_status: ProcessingStatus
    verification_status: Optional[VerificationStatus] = None
    scores: Optional[ScoreBreakdown] = None
    details: Optional[VerificationDetails] = None
    original_image_url: Optional[str] = None
    resolution_image_url: Optional[str] = None
    created_at: str
    updated_at: str
    processing_duration_ms: Optional[float] = None
    error_message: Optional[str] = None

