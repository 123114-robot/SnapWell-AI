# Package-label OCR fixtures

Real photos of package labels, used to regression-test the two-pass OCR
pipeline (`../../ocr.js`) and the parsers in `../../../product/productData.js`.

These are test inputs only. They live under `src/` rather than `public/` so
Vite never bundles them into the app — nothing imports them at runtime.

## Adding a fixture

1. Save the photo here as **JPG or PNG**. Do not commit `.heic` / `.HEIC`
   (the repo `.gitignore` drops those, and neither Tesseract nor `<img>`
   reads them reliably). On iPhone: Settings → Camera → Formats →
   Most Compatible, or export a copy as JPEG.
2. Name it `<product>-<what-it-should-prove>.jpg`, all lowercase, e.g.
   `pasta-sauce-nutrition-panel.jpg`.
3. Add a sidecar `<same-name>.expected.json` recording what a correct read
   must produce, so the test asserts on values rather than on a text blob:

   ```json
   {
     "note": "Woolworths Extra Lean Beef Mince 500 g, flat back-of-pack label",
     "ingredientLabel": "beef_mince",
     "nutritionPer100g": {
       "energyKj": 545,
       "proteinG": 21.2,
       "fatG": 5.0,
       "sugarsG": 1.0,
       "fibreG": null,
       "sodiumMg": 56
     },
     "allergens": { "contains": [], "traces": [] }
   }
   ```

   Use `null` for a nutrient the label genuinely does not print. Transcribe
   the printed per-100 g column, not the per-serving column, even when the two
   are identical. See `pasta-sauce-nutrition-panel.expected.json` for the
   shape, including how to record a known gap the tests do not yet cover.

## The recognised-text companions

Alongside each photo sit `<name>.single-block.txt` and `<name>.sparse-text.txt`
— what Tesseract actually returns for that image in each page segmentation
mode. Parser tests read those instead of running OCR, so `npm test` stays fast
and deterministic; the photo is kept so they can be regenerated when the OCR
pipeline changes.

The two differ in a way that matters. Single-block keeps a printed table row on
one line, which is what `parseNutritionPanel` needs. Sparse emits one cell per
line in column order, which shreds the row structure — compare the two files on
the `Energy` row. That is why the label-detail pass in `screens/ScanPackage.jsx`
does not use sparse mode.

## Keep them small

Downscale to the longest edge a phone actually produces (~1200-1600 px) before
committing. A 12 MP original adds megabytes to the repo and tells the pipeline
nothing extra, since `ocr.js` caps at `MAX_EDGE` anyway.
