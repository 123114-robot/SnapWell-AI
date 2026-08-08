# Interface: detection output → ingredient list

`detect()` (src/ai/detector.js) returns `{ detections, timing }`.
Screens after IngredientConfirm operate on `ingredients` in AppState:

```json
{
  "id": 0,
  "label": "apple",
  "confidence": 0.67,
  "quantity": 1,
  "unit": "piece",
  "source": "detected",
  "bbox": { "x": 120, "y": 80, "w": 200, "h": 210 }
}
```

- `source`: "detected" | "manual" — manual entries (human-in-the-loop
  additions) have `confidence: null` and `bbox: null`.
- UI may edit `label`, `quantity`, `unit`, delete entries, add manual ones.
- `label` values come from src/ai/labels.js (COCO for now; replaced by
  the custom ingredient taxonomy in Sprint 2 — same shape, new values).