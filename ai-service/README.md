# CivicPulse AI Resolution Verification Microservice

Lightweight Python microservice for bidirectional verification of municipal resolution photographs using **MobileNetV3-Small Siamese Perceptual Similarity**, **ORB-based Bidirectional Feature Correspondence**, and **Conditional Semantic Segmentation**.

Designed for **CPU-first inference**, **zero external cloud API costs**, and **transparent explainability**.

---

## 1. System Architecture

```
Field Worker Uploads Photo
           │
           ▼
CivicPulse Backend (TanStack / Vite)
           │ (asynchronous trigger)
           ▼
FastAPI Verification Endpoint (`POST /api/verification/submit`)
           │
           ▼
Database-Backed Job Queue (Atomic file locks, deduplication)
           │
           ▼
Background Worker Pipeline:
  1. Image Preprocessing (EXIF correction, 512x512 aspect scaling, normalization)
  2. Image Quality & Blur Check (Laplacian variance, contrast, brightness)
  3. Perceptual Hashing (pHash duplicate / reused photo detection)
  4. Siamese Perceptual Similarity (MobileNetV3-Small shared-weight encoder)
  5. Bidirectional Verification (Forward: Orig→Res coverage, Backward: Res→Orig context)
  6. Conditional Semantic Segmentation (DeepLabV3 MobileNetV3-Large, run when ambiguous)
  7. Multi-Evidence Weighted Scoring & Status Generation
           │
           ▼
Saved to verification_results.json & Synced with Admin Dashboard
```

---

## 2. Key Models & Computational Profile

| Component | Model Backbone | Weights / Source | Role in System |
| :--- | :--- | :--- | :--- |
| **Perceptual Siamese Encoder** | MobileNetV3-Small | ImageNet1K Pretrained (`torchvision`) | Scene consistency & background feature match (not resolution success proof) |
| **Bidirectional Correspondence** | ORB + BFMatcher | OpenCV | Keypoint spatial distribution & visual correspondence coverage |
| **Perceptual Hash** | pHash (DCT-based) | `imagehash` | Identifies reused or identical images (Hamming distance) |
| **Conditional Segmentation** | DeepLabV3 (MobileNetV3-Large) | Pascal VOC / COCO (`torchvision`) | Scene layout & ground surface change (supplementary evidence) |

### Computational Footprint (Measured on CPU)
- **RAM footprint:** ~250MB - 450MB
- **Inference Latency:** 200ms - 600ms per pair on modern multi-core CPU
- **GPU Required:** No (100% CPU inference)
- **External API Costs:** \$0.00 / free

---

## 3. Local Setup & Execution

### Prerequisites
- Python 3.10+ (tested on Python 3.10, 3.11, 3.12, 3.14)
- Virtual environment tool (`venv` or `conda`)

### Step 1: Create Virtual Environment
```bash
cd ai-service
python3 -m venv venv
source venv/bin/activate
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Configure Environment
```bash
cp .env.example .env
```

### Step 4: Run the Microservice
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

The service will be available at:
- API Root: `http://localhost:8001/`
- Health check: `http://localhost:8001/health`
- Interactive OpenAPI Docs: `http://localhost:8001/docs`

---

## 4. API Endpoints

### 1. `POST /api/verification/submit`
Submit a resolution verification job (asynchronous).
- **Headers:** `x-service-token: civicpulse-ai-secret-change-in-production`
- **Body:**
```json
{
  "report_id": "CIV-95674",
  "original_image_url": "/media/evidence/pothole_before.jpg",
  "resolution_image_url": "/media/evidence/pothole_resolved.jpg",
  "report_category": "roads",
  "submitted_by": "R. Manjunath"
}
```
- **Response:** HTTP 202 Accepted with `job_id`.

### 2. `GET /api/verification/{job_id}`
Retrieve verification job status, multi-model breakdown scores, and visual evidence explanations.

### 3. `GET /api/verification/report/{report_id}`
Retrieve all past verification attempts and audit history for a specific report.

### 4. `GET /health`
Returns loaded model states, CPU status, and uptime.

---

## 5. Running the CivicPulse Full Stack Application

### Run Node/Vite Frontend & Backend:
```bash
# In the project root directory:
npm run dev
# or
bun dev
```

### Access Application:
- Citizen Portal & Tracking: `http://localhost:5173/`
- Admin Management Queue & AI Inspector: `http://localhost:5173/admin/reports`
- Single Report Detail & Live Timeline: `http://localhost:5173/reports/CIV-95674`
