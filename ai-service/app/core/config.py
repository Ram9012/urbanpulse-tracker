"""
CivicPulse AI Verification Microservice
Configuration & Settings
"""

from pydantic_settings import BaseSettings
import os


class Settings(BaseSettings):
    service_name: str = "CivicPulse AI Verification Service"
    service_version: str = "1.0.0"

    host: str = "0.0.0.0"
    port: int = 8001
    debug: bool = False

    api_secret_key: str = "civicpulse-ai-secret-change-in-production"

    max_image_size_bytes: int = 15 * 1024 * 1024  # 15 MB
    processing_resolution: int = 512
    allowed_extensions: set = {"jpg", "jpeg", "png", "webp"}

    feature_extractor_model: str = "mobilenet_v3_small"
    segmentation_model: str = "deeplabv3_mobilenet_v3_large"

    model_cache_dir: str = os.path.join(os.path.dirname(__file__), "..", "models_cache")

    scene_consistency_threshold: float = 0.55
    siamese_similarity_threshold: float = 0.50
    bidirectional_threshold: float = 0.50
    final_verified_threshold: float = 0.60
    final_needs_review_threshold: float = 0.40

    weight_scene_consistency: float = 0.30
    weight_siamese_similarity: float = 0.25
    weight_bidirectional: float = 0.20
    weight_segmentation: float = 0.15
    weight_quality: float = 0.10

    phash_duplicate_threshold: int = 10

    # ORB Feature Extraction Settings
    orb_nfeatures: int = 1000
    orb_match_ratio_thresh: float = 0.75

    max_retries: int = 3
    job_timeout_seconds: int = 120

    jobs_file: str = os.path.join(
        os.path.dirname(__file__), "..", "data", "verification_jobs.json"
    )
    results_file: str = os.path.join(
        os.path.dirname(__file__), "..", "data", "verification_results.json"
    )

    class Config:
        env_file = ".env"
        env_prefix = "AI_"


settings = Settings()
