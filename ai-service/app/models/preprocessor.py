"""
CivicPulse AI Verification Microservice
Image Preprocessing Pipeline
"""

import io
import hashlib
import logging
from pathlib import Path
from typing import Tuple, Optional, Dict, Any

import cv2
import numpy as np
from PIL import Image, ImageOps

from app.core.config import settings

logger = logging.getLogger(__name__)

IMAGENET_MEAN = np.array([0.485, 0.456, 0.406], dtype=np.float32)
IMAGENET_STD = np.array([0.229, 0.224, 0.225], dtype=np.float32)


class ImagePreprocessor:
    def validate_image_bytes(self, data: bytes, filename: str = "") -> Dict[str, Any]:
        errors = []
        if len(data) > settings.max_image_size_bytes:
            errors.append(
                f"Image size {len(data) / 1024 / 1024:.1f} MB exceeds limit "
                f"{settings.max_image_size_bytes / 1024 / 1024:.0f} MB"
            )

        ext = Path(filename).suffix.lower().lstrip(".")
        if filename and ext not in settings.allowed_extensions:
            errors.append(f"File extension '.{ext}' not allowed. Use: {settings.allowed_extensions}")

        try:
            img = Image.open(io.BytesIO(data))
            img.verify()
            format_ok = True
        except Exception as e:
            errors.append(f"Invalid image data: {e}")
            format_ok = False

        return {
            "valid": len(errors) == 0,
            "errors": errors,
            "size_bytes": len(data),
            "format_ok": format_ok,
        }

    def load_and_correct(self, data: bytes) -> Image.Image:
        img = Image.open(io.BytesIO(data))
        try:
            img = ImageOps.exif_transpose(img)
        except Exception:
            pass

        if img.mode == "RGBA":
            background = Image.new("RGB", img.size, (255, 255, 255))
            background.paste(img, mask=img.split()[3])
            img = background
        elif img.mode != "RGB":
            img = img.convert("RGB")

        return img

    def resize_preserve_aspect(self, img: Image.Image, target: int = None) -> Image.Image:
        target = target or settings.processing_resolution
        w, h = img.size
        scale = target / max(w, h)
        new_w = int(w * scale)
        new_h = int(h * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)

        padded = Image.new("RGB", (target, target), (0, 0, 0))
        offset_x = (target - new_w) // 2
        offset_y = (target - new_h) // 2
        padded.paste(img, (offset_x, offset_y))
        return padded

    def to_numpy(self, img: Image.Image) -> np.ndarray:
        return np.array(img, dtype=np.float32) / 255.0

    def normalize_imagenet(self, arr: np.ndarray) -> np.ndarray:
        return (arr - IMAGENET_MEAN) / IMAGENET_STD

    def to_opencv(self, img: Image.Image) -> np.ndarray:
        return cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)

    def compute_md5(self, data: bytes) -> str:
        return hashlib.md5(data).hexdigest()

    def compute_phash(self, img: Image.Image) -> Optional[str]:
        try:
            import imagehash
            return str(imagehash.phash(img))
        except Exception as e:
            logger.warning(f"pHash computation failed: {e}")
            return None

    def phash_distance(self, hash1_str: str, hash2_str: str) -> Optional[int]:
        try:
            import imagehash
            h1 = imagehash.hex_to_hash(hash1_str)
            h2 = imagehash.hex_to_hash(hash2_str)
            return h1 - h2
        except Exception as e:
            logger.warning(f"pHash distance computation failed: {e}")
            return None

    def assess_quality(self, img: Image.Image) -> Dict[str, Any]:
        gray = cv2.cvtColor(self.to_opencv(img), cv2.COLOR_BGR2GRAY)
        laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        is_blurry = laplacian_var < 100.0

        mean_brightness = float(gray.mean())
        too_dark = mean_brightness < 40
        too_bright = mean_brightness > 220

        contrast = float(gray.std())
        low_contrast = contrast < 15

        score = 1.0
        flags = []
        if is_blurry:
            score -= 0.30
            flags.append("blurry_image")
        if too_dark:
            score -= 0.25
            flags.append("too_dark")
        if too_bright:
            score -= 0.20
            flags.append("overexposed")
        if low_contrast:
            score -= 0.15
            flags.append("low_contrast")

        score = max(0.0, score)
        rating = "good" if score >= 0.7 else "fair" if score >= 0.4 else "poor"

        return {
            "score": score,
            "rating": rating,
            "laplacian_variance": laplacian_var,
            "mean_brightness": mean_brightness,
            "contrast": contrast,
            "flags": flags,
        }

    def preprocess_for_model(
        self, data: bytes, target_size: int = None
    ) -> Tuple[np.ndarray, Image.Image, Dict[str, Any]]:
        target_size = target_size or settings.processing_resolution
        pil_img = self.load_and_correct(data)
        original_size = pil_img.size
        quality = self.assess_quality(pil_img)
        pil_resized = self.resize_preserve_aspect(pil_img, target_size)
        arr = self.to_numpy(pil_resized)
        arr_normalized = self.normalize_imagenet(arr)

        metadata = {
            "original_size": original_size,
            "processed_size": (target_size, target_size),
            "quality": quality,
            "md5": self.compute_md5(data),
            "phash": self.compute_phash(pil_img),
        }

        return arr_normalized, pil_resized, metadata


preprocessor = ImagePreprocessor()

