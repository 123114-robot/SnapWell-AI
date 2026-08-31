# SnapWell v2 training logs

Raw Ultralytics terminal output from the SnapWell-ingredients YOLOv8n fine-tune
(Roboflow dataset v2, 39 classes). Kept as evidence for the team and A3 — not
required to run the app.

## Files

| File | What it is |
|---|---|
| `training-terminal.txt` | Full `yolo detect train` session (command, hyperparameters, epoch progress, early stop, val metrics on `best.pt`) |
| `test-split.txt` | `yolo detect val … split=test` per-class table, plus a quick check of classes missing from the valid split |

## How these runs were produced

```bash
# Train (Apple M3 Pro / MPS)
yolo detect train model=yolov8n.pt data=data/snapwell-v2/data.yaml \
  epochs=100 imgsz=640 batch=16 device=mps workers=4 amp=False patience=25 \
  project=runs name=snapwell-v2-100e

# Evaluate on held-out test split
yolo detect val model=runs/detect/runs/snapwell-v2-100e/weights/best.pt \
  data=data/snapwell-v2/data.yaml split=test imgsz=640 device=mps \
  project=runs name=snapwell-v2-test
```

Dataset download (needs `ROBOFLOW_API_KEY`):

```bash
python scripts/download_dataset.py
```

## Headline numbers (from these logs)

| Split / protocol | mAP50 | mAP50-95 | Notes |
|---|---:|---:|---|
| Val at best epoch (epoch 60), training log | 0.673 | 0.454 | Early stop at epoch 85 (patience 25) |
| **Test** (`test-split.txt`) | **0.603** | **0.412** | Rect-style Ultralytics val default |
| Deploy / letterbox (`rect=False`) | 0.557 | 0.376 | See `docs/snapwell-v2-deployment.md` |

Browser integration uses `app/public/models/snapwell-v2.onnx` (exported from `best.pt`).
Weights and `runs/` plots stay local and are not committed.
