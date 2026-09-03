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

- `source`: "detected" | "manual" | "ocr".
  - "manual" entries (human-in-the-loop additions) have `confidence: null`
    and `bbox: null`.
  - "ocr" entries come from the package-label scanner (src/screens/ScanPackage.jsx,
    src/ai/ocr.js, src/ai/ingredientMatch.js). `bbox` is null and these extra
    fields are present:
    - `confidence` — the matcher's score (0–1) that this product is present,
      or null when the user picked the ingredient from the list by hand.
    - `ocrConfidence` — the raw Tesseract confidence, scaled to 0–1.
    - `ocrText` — the full recognised (user-edited) label text.
    - `ausnutKey` — the AUSNUT public food key the label maps to.

    `label` is never free text. It is always one of the 49 labels defined in
    data/food_data/ingredient-map-v1.json, so every OCR entry is guaranteed to
    resolve for the nutrition and recipe stages.
- UI may edit `label`, `quantity`, `unit`, delete entries, add manual ones.
- Detected `label` values come from src/ai/labels.js (SnapWell v2, 39
  ingredient classes; must match public/models/classes.json).

## Label display

`label` is the storage key and keeps its underscores (`beef_mince`,
`canned_tomatoes`). Screens render it through `displayName()` in
src/ai/ingredientMatch.js, which gives "Beef mince" / "Canned tomatoes".
Do not render a raw `label` in the UI.
