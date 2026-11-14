"""CNN document classifier + structured field extraction microservice (PyTorch + OpenCV).

Pipeline: bytes -> OpenCV deskew/denoise/threshold -> CNN classifier (invoice | id | shipping_label | other)
          -> OCR (pytesseract if present) -> regex key-value extraction -> confidence-gated response.
Weights load from /weights/doc_cnn.pt; without weights the model is randomly initialised and the
response is flagged `model_trained: false` so the UI never treats it as authoritative.
"""
from __future__ import annotations

import io
import os
import re

import cv2
import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from fastapi import FastAPI, File, HTTPException, UploadFile

CLASSES = ["invoice", "id_card", "shipping_label", "other"]
WEIGHTS = os.environ.get("CNN_WEIGHTS", "/weights/doc_cnn.pt")
REVIEW_THRESHOLD = 0.85


class DocCNN(nn.Module):
    def __init__(self, n_classes: int = len(CLASSES)):
        super().__init__()
        def block(i, o):
            return nn.Sequential(nn.Conv2d(i, o, 3, padding=1), nn.BatchNorm2d(o), nn.ReLU(), nn.MaxPool2d(2))
        self.features = nn.Sequential(block(1, 16), block(16, 32), block(32, 64), block(64, 128))
        self.head = nn.Sequential(nn.AdaptiveAvgPool2d(1), nn.Flatten(), nn.Dropout(0.3), nn.Linear(128, n_classes))

    def forward(self, x):
        return self.head(self.features(x))


model = DocCNN().eval()
trained = False
if os.path.exists(WEIGHTS):
    model.load_state_dict(torch.load(WEIGHTS, map_location="cpu", weights_only=True))
    trained = True


def preprocess(raw: bytes) -> tuple[np.ndarray, np.ndarray]:
    img = cv2.imdecode(np.frombuffer(raw, np.uint8), cv2.IMREAD_GRAYSCALE)
    if img is None:
        raise HTTPException(422, "Unreadable image")
    img = cv2.fastNlMeansDenoising(img, h=10)
    bw = cv2.adaptiveThreshold(img, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 15)
    small = cv2.resize(bw, (224, 224)).astype(np.float32) / 255.0
    return small, bw


def ocr(bw: np.ndarray) -> str:
    try:
        import pytesseract

        return pytesseract.image_to_string(bw)
    except Exception:
        return ""


FIELD_PATTERNS = {
    "invoice_number": re.compile(r"(?:invoice|inv)[\s#:no.]*([A-Z0-9-]{4,})", re.I),
    "total": re.compile(r"total[^\d]{0,10}([\d,]+\.\d{2})", re.I),
    "date": re.compile(r"(\d{4}-\d{2}-\d{2}|\d{2}[/-]\d{2}[/-]\d{4})"),
    "tracking": re.compile(r"\b([A-Z]{2}\d{9}[A-Z]{2}|\d{12,14})\b"),
}


def extract_fields(text: str) -> dict:
    return {k: m.group(1) for k, rx in FIELD_PATTERNS.items() if (m := rx.search(text))}


app = FastAPI(title="Nexus CNN Service")


@app.get("/health")
def health():
    return {"status": "ok", "model_trained": trained}


@app.post("/extract")
async def extract(file: UploadFile = File(...)):
    raw = await file.read()
    if len(raw) > 10 * 1024 * 1024:
        raise HTTPException(413, "File too large")
    small, bw = preprocess(raw)
    with torch.no_grad():
        probs = F.softmax(model(torch.from_numpy(small)[None, None]), dim=1)[0]
    conf, idx = probs.max(0)
    text = ocr(bw)
    fields = extract_fields(text)
    return {
        "class": CLASSES[int(idx)],
        "confidence": round(float(conf), 4),
        "fields": fields,
        "needs_human_review": float(conf) < REVIEW_THRESHOLD or not trained,
        "model_trained": trained,
    }


@app.post("/anomaly")
async def anomaly(series: list[float]):
    """1D-CNN-style spike detector: convolve with a Laplacian kernel, flag |z| > 3."""
    if len(series) < 8:
        raise HTTPException(422, "Need at least 8 points")
    x = torch.tensor(series, dtype=torch.float32)[None, None]
    k = torch.tensor([[[1.0, -2.0, 1.0]]])
    r = F.conv1d(x, k, padding=1)[0, 0]
    z = (r - r.mean()) / (r.std() + 1e-8)
    return {"anomalies": [i for i, v in enumerate(z.tolist()) if abs(v) > 3]}
