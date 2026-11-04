"""
CivicPulse AI Verification Microservice
Verification Engine — Combines all pipeline components

Orchestrates the full verification pipeline:
1. Image preprocessing
2. Quality assessment
3. Duplicate detection (pHash)
4. Siamese perceptual similarity (MobileNetV3-Small)
5. Bidirectional visual correspondence (ORB)
6. Conditional semantic segmentation (DeepLabV3, only when needed)
7. Score combination and final verdict

Score weighting and thresholds are externalized to config.py.
The combination logic is documented as a baseline requiring
validation against labeled before/after image pairs.
"""

import logging
import time
from typing import Optional, Dict, Any, Tuple

import numpy as np
from PIL import Image

from app.core.config import settings
from app.core.schemas import VerificationStatus, VerificationDetails, ScoreBreakdown
from app.models.preprocessor import preprocessor
from app.models.feature_extractor import feature_extractor
from app.models.bidirectional import bidirectional_verifier
from app.models.segmentation import segmentation_model

logger = logging.getLogger(__name__)

# Categories where segmentation adds value even without domain training
SEGMENTATION_PRIORITY_CATEGORIES = {"roads", "water", "waste"}

# Categories / conditions where we run segmentation always
ALWAYS_SEGMENT_CATEGORIES = set()  # empty until domain model available


def _should_run_segmentation(
    category: Optional[str],
    siamese_score: float,
    bidirectional_score: float,
) -> bool:
    """
    Decide whether to run segmentation based on:
    1. Report category (some benefit more from spatial analysis)
    2. Whether earlier scores are ambiguous (inconclusive middle range)
    3. Whether segmentation model is loaded
    """
    if not segmentation_model.is_loaded:
        return False

    if category and category.lower() in ALWAYS_SEGMENT_CATEGORIES:
        return True

    # Run segmentation when similarity evidence is ambiguous
    lower_bound = settings.final_needs_review_threshold
    upper_bound = settings.final_verified_threshold

    # Both scores in the inconclusive middle band → add segmentation evidence
    both_ambiguous = (
        lower_bound <= siamese_score <= upper_bound
        and lower_bound <= bidirectional_score <= upper_bound
    )

    if both_ambiguous:
        return True

    # Priority categories get segmentation if at least one score is ambiguous
    if category and category.lower() in SEGMENTATION_PRIORITY_CATEGORIES:
        if lower_bound <= siamese_score <= upper_bound:
            return True
        if lower_bound <= bidirectional_score <= upper_bound:
            return True

    return False


def _combine_scores(
    scene_consistency: float,
    siamese_similarity: float,
    bidirectional: float,
    segmentation: Optional[float],
    quality: float,
) -> float:
    """
    Compute Final Verification Score as the unweighted arithmetic average of active sub-models.
    If segmentation is not run (None), averages the 4 active sub-models.
    """
    active_scores = [scene_consistency, siamese_similarity, bidirectional, quality]
    if segmentation is not None:
        active_scores.append(segmentation)

    final = sum(active_scores) / len(active_scores)
    return float(np.clip(final, 0.0, 1.0))


def _determine_status(
    final_score: float,
    flags: list,
    quality_score: float,
) -> Tuple[VerificationStatus, str]:
    """
    Map final score + flags to a verification status and explanation.

    Thresholds (from config, baseline — needs empirical validation):
        >= final_verified_threshold (0.60) → VERIFIED
        >= final_needs_review_threshold (0.40) → NEEDS_REVIEW
        < final_needs_review_threshold → INSUFFICIENT_EVIDENCE or NEEDS_REVIEW

    Flags can override the score-based verdict:
        - images_appear_unrelated → NEEDS_REVIEW regardless of score
        - image too poor quality → INSUFFICIENT_EVIDENCE
    """
    # Quality gate: if resolution image is very poor, we can't verify
    if quality_score < 0.25:
        return (
            VerificationStatus.INSUFFICIENT_EVIDENCE,
            "Resolution photograph quality is too poor to perform reliable verification. "
            "Please upload a clearer, well-lit photograph of the resolved issue.",
        )

    # Unrelated image flag overrides score
    if "images_appear_unrelated" in flags:
        return (
            VerificationStatus.NEEDS_REVIEW,
            "Resolution photograph appears unrelated to the original report location. "
            "Manual administrator review is required.",
        )

    # Score-based verdict
    if final_score >= settings.final_verified_threshold:
        return (
            VerificationStatus.VERIFIED,
            f"Visual evidence supports resolution claim. "
            f"Scene consistency and feature correspondence are within acceptable range "
            f"(composite score: {final_score:.2f}). "
            f"Administrator may still override.",
        )
    elif final_score >= settings.final_needs_review_threshold:
        return (
            VerificationStatus.NEEDS_REVIEW,
            f"Verification evidence is inconclusive (composite score: {final_score:.2f}). "
            f"The images show partial correspondence but require human review to confirm resolution.",
        )
    else:
        return (
            VerificationStatus.INSUFFICIENT_EVIDENCE,
            f"Insufficient visual evidence to verify resolution (composite score: {final_score:.2f}). "
            f"The resolution photograph does not appear to clearly correspond to the original complaint.",
        )


class VerificationEngine:
    """
    Main orchestrator for the AI verification pipeline.
    Stateless — model singletons are loaded separately.
    """

    def verify(
        self,
        original_data: bytes,
        resolution_data: bytes,
        original_filename: str = "original.jpg",
        resolution_filename: str = "resolution.jpg",
        report_category: Optional[str] = None,
        report_description: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Run the full verification pipeline.

        Args:
            original_data: Raw bytes of original citizen photograph
            resolution_data: Raw bytes of resolution photograph
            original_filename: Filename for extension validation
            resolution_filename: Filename for extension validation
            report_category: Optional category hint (roads, waste, water, etc.)
            report_description: Optional original description for context

        Returns:
            dict with full verification results including scores, status, explanation
        """
        t_start = time.time()
        pipeline_steps = []
        all_flags = []
        all_limitations = []

        # ─── STEP 1: Validate inputs ───────────────────────────────────────
        pipeline_steps.append("image_validation")

        orig_validation = preprocessor.validate_image_bytes(original_data, original_filename)
        res_validation = preprocessor.validate_image_bytes(resolution_data, resolution_filename)

        if not orig_validation["valid"]:
            return self._error_result(
                f"Original image validation failed: {orig_validation['errors']}",
                pipeline_steps,
                time.time() - t_start,
            )
        if not res_validation["valid"]:
            return self._error_result(
                f"Resolution image validation failed: {res_validation['errors']}",
                pipeline_steps,
                time.time() - t_start,
            )

        # ─── STEP 2: Preprocess both images ───────────────────────────────
        pipeline_steps.append("preprocessing")

        try:
            orig_norm, orig_pil, orig_meta = preprocessor.preprocess_for_model(original_data)
            res_norm, res_pil, res_meta = preprocessor.preprocess_for_model(resolution_data)
        except Exception as e:
            return self._error_result(
                f"Image preprocessing failed: {e}", pipeline_steps, time.time() - t_start
            )

        orig_quality = orig_meta["quality"]
        res_quality = res_meta["quality"]
        all_flags.extend([f"original_{f}" for f in orig_quality.get("flags", [])])
        all_flags.extend([f"resolution_{f}" for f in res_quality.get("flags", [])])

        # ─── STEP 3: Duplicate detection (pHash) ─────────────────────────
        pipeline_steps.append("duplicate_detection")

        orig_phash = orig_meta.get("phash")
        res_phash = res_meta.get("phash")
        phash_distance = None
        is_suspected_duplicate = False

        if orig_phash and res_phash:
            phash_distance = preprocessor.phash_distance(orig_phash, res_phash)
            if phash_distance is not None:
                if phash_distance <= settings.phash_duplicate_threshold:
                    is_suspected_duplicate = True
                    all_flags.append("suspected_duplicate_or_identical_image")
                    logger.warning(
                        f"Suspected duplicate: pHash distance={phash_distance} "
                        f"(threshold={settings.phash_duplicate_threshold})"
                    )

        # ─── STEP 4: Siamese perceptual similarity ────────────────────────
        pipeline_steps.append("siamese_similarity")

        siamese_score = 0.0
        orig_embedding = None
        res_embedding = None

        if feature_extractor.is_loaded:
            siamese_score, orig_embedding, res_embedding = feature_extractor.compute_similarity(
                orig_pil, res_pil
            )
            logger.info(f"Siamese similarity: {siamese_score:.4f}")
        else:
            all_flags.append("feature_extractor_unavailable")
            all_limitations.append(
                "MobileNetV3 feature extractor not loaded. Siamese similarity set to 0."
            )

        # Scene consistency is primarily the siamese score
        # (same feature space, different framing — measures perceptual closeness)
        scene_consistency_score = siamese_score

        # ─── STEP 5: Bidirectional verification ──────────────────────────
        pipeline_steps.append("bidirectional_verification")

        bidir_result = bidirectional_verifier.verify(
            orig_pil, res_pil,
            orig_embedding=orig_embedding,
            res_embedding=res_embedding,
        )
        bidirectional_score = bidir_result["bidirectional_score"]
        all_flags.extend(bidir_result.get("flags", []))
        logger.info(f"Bidirectional score: {bidirectional_score:.4f}")

        # ─── STEP 6: Conditional segmentation ────────────────────────────
        segmentation_score = None
        seg_result = None

        if _should_run_segmentation(report_category, siamese_score, bidirectional_score):
            pipeline_steps.append("semantic_segmentation")
            logger.info("Running conditional semantic segmentation...")
            seg_result = segmentation_model.analyze_pair(orig_pil, res_pil)
            segmentation_score = seg_result.get("segmentation_score")
            all_flags.extend(seg_result.get("flags", []))
            all_limitations.extend(seg_result.get("limitations", []))
            logger.info(f"Segmentation score: {segmentation_score}")
        else:
            pipeline_steps.append("segmentation_skipped")
            logger.debug("Segmentation skipped (not needed for this submission)")

        # ─── STEP 7: Combine scores ───────────────────────────────────────
        pipeline_steps.append("score_combination")

        quality_score = res_quality["score"]  # Resolution image quality is what we can assess
        final_score = _combine_scores(
            scene_consistency=scene_consistency_score,
            siamese_similarity=siamese_score,
            bidirectional=bidirectional_score,
            segmentation=segmentation_score,
            quality=quality_score,
        )

        # ─── STEP 8: Determine verification status ────────────────────────
        verification_status, explanation = _determine_status(final_score, all_flags, quality_score)

        # Duplicate image override — if images are nearly identical, issue likely not resolved
        if is_suspected_duplicate and verification_status == VerificationStatus.VERIFIED:
            verification_status = VerificationStatus.NEEDS_REVIEW
            explanation = (
                "Resolution photograph appears nearly identical to the original report image "
                f"(perceptual hash distance: {phash_distance}). "
                "This may indicate the same photograph was reused. Manual review required."
            )

        processing_duration_ms = (time.time() - t_start) * 1000
        logger.info(
            f"Verification complete: status={verification_status}, "
            f"final_score={final_score:.4f}, "
            f"duration={processing_duration_ms:.0f}ms"
        )

        return {
            "verification_status": verification_status,
            "scores": ScoreBreakdown(
                scene_consistency_score=round(scene_consistency_score, 4),
                siamese_similarity_score=round(siamese_score, 4),
                bidirectional_score=round(bidirectional_score, 4),
                segmentation_score=round(segmentation_score, 4) if segmentation_score is not None else None,
                quality_score=round(quality_score, 4),
                final_verification_score=round(final_score, 4),
            ),
            "details": VerificationDetails(
                original_image_quality=orig_quality.get("rating"),
                resolution_image_quality=res_quality.get("rating"),
                orb_matches_count=bidir_result.get("forward_total_matches"),
                orb_good_matches_count=bidir_result.get("forward_good_matches"),
                feature_correspondence_ratio=bidir_result.get("feature_correspondence_ratio"),
                segmentation_ran=seg_result.get("segmentation_ran", False) if seg_result else False,
                segmentation_damage_area_before=(
                    seg_result.get("road_area_change") if seg_result else None
                ),
                duplicate_hash_distance=phash_distance,
                is_suspected_duplicate=is_suspected_duplicate,
                model_version="mobilenet_v3_small_imagenet1k_v1",
                processing_pipeline=pipeline_steps,
                evidence_explanation=explanation,
                flags=list(set(all_flags)),
            ),
            "processing_duration_ms": processing_duration_ms,
            "limitations": all_limitations,
        }

    def _error_result(
        self, error_msg: str, pipeline_steps: list, duration_s: float
    ) -> Dict[str, Any]:
        """Return a structured error result for pipeline failures."""
        logger.error(f"Verification pipeline error: {error_msg}")
        return {
            "verification_status": VerificationStatus.NEEDS_REVIEW,
            "scores": ScoreBreakdown(),
            "details": VerificationDetails(
                processing_pipeline=pipeline_steps,
                evidence_explanation=f"Verification pipeline failed: {error_msg}",
                flags=["pipeline_error"],
            ),
            "processing_duration_ms": duration_s * 1000,
            "error": error_msg,
            "limitations": [error_msg],
        }


# Module-level singleton
verification_engine = VerificationEngine()

