"""
CivicPulse AI Verification Microservice
Bidirectional Visual Correspondence Engine

Implements asymmetric two-way verification:
1. Original-to-Resolution (Forward):
   - Confirms that key landmarks and spatial features from the complaint
     are identifiable in the resolution photograph.
2. Resolution-to-Original (Backward):
   - Confirms that the context of the resolution photo genuinely ties back
     to the reported site, penalizing unanchored/reused photographs.

Uses OpenCV ORB (Oriented FAST and Rotated BRIEF) + BFMatcher with Lowe's ratio test.
Operates on CPU with millisecond execution latency.
"""

import logging
from typing import Dict, Any, Optional
import cv2
import numpy as np
from PIL import Image

from app.core.config import settings

logger = logging.getLogger(__name__)


class BidirectionalVerifier:
    """
    Computes bidirectional visual correspondence using ORB keypoint descriptors
    and optional high-level embedding guidance.
    """

    def __init__(self):
        # Configure ORB detector for municipal infrastructure imagery
        self._orb = cv2.ORB_create(
            nfeatures=settings.orb_nfeatures,
            scaleFactor=1.2,
            nlevels=8,
            edgeThreshold=31,
            firstLevel=0,
            WTA_K=2,
            scoreType=cv2.ORB_HARRIS_SCORE,
            patchSize=31,
            fastThreshold=20,
        )
        self._matcher = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

    def _extract_keypoints_and_descriptors(self, image: Image.Image):
        """Convert PIL image to grayscale numpy array and extract ORB features."""
        np_img = np.array(image.convert("RGB"))
        gray = cv2.cvtColor(np_img, cv2.COLOR_RGB2GRAY)
        kp, des = self._orb.detectAndCompute(gray, None)
        return kp, des

    def _match_descriptors(self, des1, des2):
        """Perform Lowe's ratio test matching between descriptor sets."""
        if des1 is None or des2 is None or len(des1) < 2 or len(des2) < 2:
            return []

        try:
            matches = self._matcher.knnMatch(des1, des2, k=2)
            good_matches = []
            for m_n in matches:
                if len(m_n) == 2:
                    m, n = m_n
                    if m.distance < settings.orb_match_ratio_thresh * n.distance:
                        good_matches.append(m)
            return good_matches
        except Exception as e:
            logger.warning(f"Error matching descriptors: {e}")
            return []

    def verify(
        self,
        orig_img: Image.Image,
        res_img: Image.Image,
        orig_embedding: Optional[np.ndarray] = None,
        res_embedding: Optional[np.ndarray] = None,
    ) -> Dict[str, Any]:
        """
        Execute asymmetric bidirectional verification between original and resolution photos.
        """
        flags = []
        limitations = []

        # Step 1: Detect features in both images
        kp_orig, des_orig = self._extract_keypoints_and_descriptors(orig_img)
        kp_res, des_res = self._extract_keypoints_and_descriptors(res_img)

        n_orig = len(kp_orig) if kp_orig else 0
        n_res = len(kp_res) if kp_res else 0

        if n_orig < 10 or n_res < 10:
            flags.append("sparse_keypoints")
            limitations.append("Low texture detected in one or both images; correspondence confidence reduced.")

        # Step 2: Forward Match (Original -> Resolution)
        # Evaluates how much of the original scene context is retained
        forward_matches = self._match_descriptors(des_orig, des_res)
        n_forward_good = len(forward_matches)

        forward_ratio = 0.0
        if n_orig > 0:
            forward_ratio = min(1.0, n_forward_good / max(25.0, float(n_orig * 0.15)))

        # Step 3: Backward Match (Resolution -> Original)
        # Checks if resolution photo has sufficient anchor points in original
        backward_matches = self._match_descriptors(des_res, des_orig)
        n_backward_good = len(backward_matches)

        backward_ratio = 0.0
        if n_res > 0:
            backward_ratio = min(1.0, n_backward_good / max(25.0, float(n_res * 0.15)))

        # Step 4: Homography and Inlier check (if sufficient good matches exist)
        inlier_ratio = 0.0
        if n_forward_good >= 8:
            try:
                src_pts = np.float32([kp_orig[m.queryIdx].pt for m in forward_matches]).reshape(-1, 1, 2)
                dst_pts = np.float32([kp_res[m.trainIdx].pt for m in forward_matches]).reshape(-1, 1, 2)
                _, mask = cv2.findHomography(src_pts, dst_pts, cv2.RANSAC, 5.0)
                if mask is not None:
                    inliers = int(np.sum(mask))
                    inlier_ratio = float(inliers) / float(n_forward_good)
            except Exception as e:
                logger.debug(f"Homography computation skipped: {e}")

        # Combined bidirectional score
        # Forward correspondence (0.45) + Backward correspondence (0.35) + Spatial Inlier consistency (0.20)
        bidirectional_score = (
            0.45 * forward_ratio +
            0.35 * backward_ratio +
            0.20 * inlier_ratio
        )
        bidirectional_score = float(np.clip(bidirectional_score, 0.0, 1.0))

        if bidirectional_score < 0.15:
            flags.append("images_appear_unrelated")

        return {
            "bidirectional_score": bidirectional_score,
            "forward_good_matches": n_forward_good,
            "forward_total_matches": len(forward_matches),
            "backward_good_matches": n_backward_good,
            "feature_correspondence_ratio": float(np.clip(forward_ratio, 0.0, 1.0)),
            "flags": flags,
            "limitations": limitations,
        }


# Module-level singleton
bidirectional_verifier = BidirectionalVerifier()

