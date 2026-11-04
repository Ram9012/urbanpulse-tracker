"""
CivicPulse AI Verification Microservice
MobileNetV3-Small Feature Extractor (Siamese Perceptual Similarity)

Uses a pretrained MobileNetV3-Small model (ImageNet-1K weights)
as a lightweight, CPU-efficient shared-weight encoder.
Extracts 1024-dimensional normalized embeddings and computes cosine similarity.
"""

import logging
from typing import Optional, Tuple
import numpy as np
from PIL import Image

logger = logging.getLogger(__name__)

try:
    import torch
    import torchvision.transforms as transforms
    from torchvision.models import mobilenet_v3_small, MobileNet_V3_Small_Weights

    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch or Torchvision not installed. Feature extraction disabled.")


class FeatureExtractor:
    """
    Feature extractor utilizing MobileNetV3-Small backbone for visual similarity.
    CPU-optimized and lazy-loaded.
    """

    def __init__(self):
        self._model = None
        self._transform = None
        self._is_loaded = False
        self._init_model()

    def _init_model(self):
        if not TORCH_AVAILABLE:
            return

        try:
            weights = MobileNet_V3_Small_Weights.DEFAULT
            model = mobilenet_v3_small(weights=weights)
            # MobileNetV3 small classifier has: [Linear(576, 1024), Hardswish, Dropout, Linear(1024, num_classes)]
            # We replace final Linear with Identity to obtain 1024-dim embedding
            model.classifier[3] = torch.nn.Identity()
            model.eval()
            self._model = model

            # Standard ImageNet normalization
            self._transform = transforms.Compose([
                transforms.Resize((224, 224)),
                transforms.ToTensor(),
                transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225]),
            ])
            self._is_loaded = True
            logger.info("MobileNetV3-Small feature extractor loaded successfully.")
        except Exception as e:
            logger.warning(f"Failed to load MobileNetV3 weights: {e}. Falling back to uninitialized.")
            self._is_loaded = False

    @property
    def is_loaded(self) -> bool:
        return self._is_loaded

    def extract_embedding(self, image: Image.Image) -> Optional[np.ndarray]:
        """
        Extract a normalized 1D embedding vector for a PIL image.
        """
        if not self._is_loaded or self._model is None:
            return None

        try:
            rgb_img = image.convert("RGB")
            tensor = self._transform(rgb_img).unsqueeze(0)  # Shape: (1, 3, 224, 224)

            with torch.no_grad():
                feats = self._model(tensor)
                feats = feats.squeeze().numpy()

            # L2 Normalize
            norm = np.linalg.norm(feats)
            if norm > 1e-7:
                feats = feats / norm
            return feats.astype(np.float32)
        except Exception as e:
            logger.error(f"Error extracting embedding: {e}")
            return None

    def compute_similarity(
        self, img1: Image.Image, img2: Image.Image
    ) -> Tuple[float, Optional[np.ndarray], Optional[np.ndarray]]:
        """
        Compute cosine similarity between two images.
        Returns: (similarity_score, emb1, emb2)
        """
        emb1 = self.extract_embedding(img1)
        emb2 = self.extract_embedding(img2)

        if emb1 is None or emb2 is None:
            return 0.0, emb1, emb2

        # Dot product of L2 normalized vectors is cosine similarity
        cos_sim = float(np.dot(emb1, emb2))
        # Rescale [-1, 1] to [0, 1] for confidence representation
        score = max(0.0, min(1.0, (cos_sim + 1.0) / 2.0))
        return score, emb1, emb2


# Module-level singleton
feature_extractor = FeatureExtractor()

