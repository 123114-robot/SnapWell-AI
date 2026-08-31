# SnapWell v2 on-device deployment notes

Parameters for the browser-integrated fine-tuned detector. Suitable for direct
citation in A3 (deployment / evaluation sections).

## Model artifact

| Item | Value |
|---|---|
| File | `app/public/models/snapwell-v2.onnx` |
| Size | 11.7 MB (FP32) |
| Source weights | `runs/detect/runs/snapwell-v2-100e/weights/best.pt` → ONNX export |
| Opset | 12 |
| Input | `[1, 3, 640, 640]` float32, letterbox (pad RGB 114), /255 |
| Output | `[1, 43, 8400]` = 4 box coords + **39** class scores × 8400 anchors |
| Class list | `app/public/models/classes.json` (must match `classes.txt` / `data/snapwell-v2/data.yaml`) |
| Runtime | ONNX Runtime Web (wasm), existing Vite `ort.wasm.bundle` alias |

Vision training covers **39** ingredient classes. Packaged / pantry labels such as
`olive_oil` and `pasta_sauce` remain on the **OCR channel**, not in this detector.

## Export fidelity

PyTorch vs ONNX under matching `rect=False` (square 640×640 letterbox) evaluation
are **identical per class** (aggregate **0.557 / 0.376**). Export introduces
**zero metric loss**.

Earlier gaps between training logs and ONNX were caused by **rectangular inference
vs square letterbox** evaluation protocol differences, not by the export itself.

## Test-set metrics (report both)

| Protocol | mAP50 | mAP50-95 | Notes |
|---|---:|---:|---|
| PyTorch, `rect=True` | **0.603** | — | Training / Ultralytics default rectangular eval |
| Deploy condition, 640×640 letterbox (`rect=False`) | **0.557** | **0.376** | Matches browser preprocess |

A3 should quote **both** numbers and state that the product path uses letterbox
(same as ORT Web).

## Browser integration

| Piece | Location |
|---|---|
| Model URL | `/models/snapwell-v2.onnx` via `ModelContext.jsx` |
| Labels | Static `NAMES` in `app/src/ai/labels.js` (39; no runtime fetch) |
| Decode | `NUM_CLASSES = NAMES.length` in `detector.js` (was hardcoded 80 for COCO) |
| NMS | conf 0.25, IoU 0.45 (unchanged) |
| Warm-up | Blank tensor `session.run` after load (unchanged) |

### First browser sample (not for formal SLA)

Single avocado test image after model ready (Chrome / M3 Pro class machine),
one-shot `detect()` via the production `detector.js` path:

| Stage | ms |
|---|---:|
| Preprocess | 275.3 |
| Inference | 187.8 |
| Postprocess | 1.7 |
| **Total** | **464.8** |

Labels returned: `avocado` (≈0.90), `avocado` (≈0.79). No COCO class leakage.

**Do not** use this single sample as the published latency claim. Formal
evaluation point 2 requires ≥20 runs on the same image (drop run 1), report
median and p95 of runs 2–20, plus separate `createSession` + `warmUp` cold-start,
on at least M3 Pro and one mid-range Android.

## Out of repo (local only)

Training datasets (`data/`), Ultralytics `runs/`, and large weight files stay local
and are not part of the deployed app bundle. Reproducible download:
`scripts/download_dataset.py`.

Raw train / test terminal logs (commands + per-class tables) are archived under
[`docs/training/`](training/README.md) for A3 and teammate review.
