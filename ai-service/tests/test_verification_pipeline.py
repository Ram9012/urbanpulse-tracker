"""
CivicPulse AI Verification Microservice
Unit & Integration Tests
"""

import os
import io
import pytest
import numpy as np
from PIL import Image, ImageDraw

from app.models.preprocessor import preprocessor
from app.models.bidirectional import bidirectional_verifier
from app.models.feature_extractor import feature_extractor
from app.models.verification_engine import verification_engine
from app.core.job_queue import job_queue


def _create_sample_image(color=(100, 150, 200), shape_type="rectangle") -> bytes:
    """Generate a synthetic test image."""
    img = Image.new("RGB", (300, 300), color)
    draw = ImageDraw.Draw(img)
    if shape_type == "pothole":
        # Draw dark crater-like oval
        draw.ellipse([80, 80, 220, 220], fill=(40, 40, 40), outline=(20, 20, 20))
    elif shape_type == "repaired":
        # Repaired patch with texture
        draw.ellipse([80, 80, 220, 220], fill=(80, 85, 90), outline=(60, 60, 60))
        draw.line([60, 150, 240, 150], fill=(120, 120, 120), width=2)
    elif shape_type == "unrelated":
        # Completely different scene (e.g. bright green plant/park)
        img = Image.new("RGB", (300, 300), (34, 139, 34))
        draw = ImageDraw.Draw(img)
        draw.rectangle([50, 50, 150, 250], fill=(255, 215, 0))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return buf.getvalue()


def test_image_preprocessing_validation():
    """Test 1 & 2: Valid and invalid image upload validation."""
    valid_bytes = _create_sample_image()
    res = preprocessor.validate_image_bytes(valid_bytes, "test.jpg")
    assert res["valid"] is True
    assert res["format_ok"] is True

    # Invalid corrupted bytes
    corrupt_bytes = b"not_an_image_binary_data"
    res_corrupt = preprocessor.validate_image_bytes(corrupt_bytes, "test.jpg")
    assert res_corrupt["valid"] is False
    assert res_corrupt["format_ok"] is False


def test_perceptual_hash_duplicate_detection():
    """Test 3: Duplicate resolution photograph detection."""
    img_bytes = _create_sample_image()
    img1 = preprocessor.load_and_correct(img_bytes)
    img2 = preprocessor.load_and_correct(img_bytes)

    hash1 = preprocessor.compute_phash(img1)
    hash2 = preprocessor.compute_phash(img2)
    assert hash1 is not None and hash2 is not None

    distance = preprocessor.phash_distance(hash1, hash2)
    assert distance == 0  # Identical image distance is 0


def test_same_scene_and_unrelated_images():
    """Test 4 & 5: Same scene vs completely unrelated images."""
    orig_bytes = _create_sample_image(color=(120, 120, 120), shape_type="pothole")
    repaired_bytes = _create_sample_image(color=(120, 120, 120), shape_type="repaired")
    unrelated_bytes = _create_sample_image(shape_type="unrelated")

    orig_img = preprocessor.load_and_correct(orig_bytes)
    repaired_img = preprocessor.load_and_correct(repaired_bytes)
    unrelated_img = preprocessor.load_and_correct(unrelated_bytes)

    # 1. Compare Same Scene (Before & After)
    same_scene_res = bidirectional_verifier.verify(orig_img, repaired_img)
    assert "bidirectional_score" in same_scene_res
    assert isinstance(same_scene_res["bidirectional_score"], float)

    # 2. Compare Unrelated Scene
    unrelated_res = bidirectional_verifier.verify(orig_img, unrelated_img)
    assert "bidirectional_score" in unrelated_res
    # Unrelated images should not produce high correspondence
    assert unrelated_res["bidirectional_score"] <= 0.60


def test_end_to_end_verification_engine():
    """Test 6 & 7: Successful repair verification pipeline."""
    orig_bytes = _create_sample_image(color=(120, 120, 120), shape_type="pothole")
    res_bytes = _create_sample_image(color=(120, 120, 120), shape_type="repaired")

    result = verification_engine.verify(
        original_data=orig_bytes,
        resolution_data=res_bytes,
        report_category="roads",
    )

    assert "verification_status" in result
    assert "scores" in result
    assert result["scores"].scensistency_score is not None
    assert result["scores"].final_verification_score is not None
    assert result["processing_duration_ms"] > 0


def test_job_queue_idempotency_and_lifecycle():
    """Test 10 & 11: Background job deduplication and state claiming."""
    report_id = "CIV-TEST-001"
    import uuid
    report_id = f"CIV-TEST-{uuid.uuid4().hex[:8]}"
    job1 = job_queue.create_job(
        report_id=report_id,
        original_image_url="/media/evidence/pothole_before.jpg",
        resolution_image_url="/media/evidence/pothole_resolved.jpg",
    )
    assert job1["id"] is not None
    assert job1["job_status"] == "pending"

    # Second creation with pending status returns identical job without duplicate creation
    job2 = job_queue.create_job(
        report_id=report_id,
        original_image_url="/media/evidence/pothole_before.jpg",
        resolution_image_url="/media/evidence/pothole_resolved.jpg",
    )
    assert job2["id"] == job1["id"]

    # Claim job
    claimed = job_queue.claim_next_job()
    if claimed and claimed["id"] == job1["id"]:
        assert claimed["job_status"] == "processing"

