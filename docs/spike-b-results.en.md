# Spike B: On-device package-label OCR

**Status:** implementation complete; initial mobile validation passed.

## Objective

Validate that a user can photograph or select an Australian packaged-food label
and have its English text read in the mobile browser without uploading the
image to a SnapWell server.

## Implementation

- **Library:** Tesseract.js 7, using an English (`eng`) worker.
- **Runtime assets:** the worker, LSTM core compatibility variants, and English
  language data are self-hosted under `web/public/tesseract/` rather than
  fetched from a third-party OCR CDN. See "Asset footprint" below — the
  repository size and the first-load download size are different numbers.
- **Runtime:** the worker is created on the first OCR request and reused for
  later images in the same browser session.
- **Pre-processing:** the user-selected text region is resized (up to a 1600 px
  longest edge). A colour-aware contrast-enhanced version and a binary version
  are each recognised locally; the higher-confidence result is returned.
- **User control:** users draw a box around any package text they want to read.
  Each recognised region is appended to one editable text field, together with
  displayed confidence and total elapsed time. This supports separate reads of a
  brand, product name, ingredients, or allergen warning without pretending that
  noisy OCR can reliably classify those fields.
- **Privacy boundary:** the selected image is passed only to browser APIs and
  the OCR worker. No application request uploads image content.

The first request loads these OCR assets from the same SnapWell web origin.
This is not an upload of the user's image. A service worker has not yet been
added, so this spike does not claim a guaranteed offline experience.

## Asset footprint

Two different numbers apply to the self-hosted OCR assets and must not be
used interchangeably.

**Repository footprint — about 22 MB.** All three core compatibility variants
(plain, SIMD, relaxed SIMD) are checked in so that any target browser is
covered.

**First-load download — about 7 MB.** A browser fetches only the variant it
needs:

| Asset | Size |
|---|---:|
| `worker.min.js` | 0.11 MB |
| one `tesseract-core-*-lstm.wasm.js` (selected by SIMD feature detection) | 3.90 MB |
| `eng.traineddata.gz` | 2.95 MB |
| **Total** | **≈ 6.96 MB** |


## Scope alignment

Spike A's COCO object detection and Spike B's OCR are currently independent
technical demonstrations presented on the same page. They are not yet a fused
classification-and-OCR pipeline. The current OCR does not infer a brand or
product name from noisy text: it preserves user-selected text regions in one
editable field. A later Sprint will train an on-device `ingredient_panel`
detector to suggest a focused OCR input while retaining manual adjustment.

## Test protocol

1. Run `npm run dev -- --host` from `web/` and open the Network URL on a phone
   connected to the same Wi-Fi network.
2. Capture or choose a front-facing Coles or Woolworths package image.
3. Drag a box around any readable package text, then select **Read selected
   text locally**. Repeat for another text region if needed.
4. Record the displayed total time, confidence, recognised text, and whether
   the text is useful without correction, useful after correction, or unusable.
5. Repeat with at least three images: clear/front-facing, reflective or tilted,
   and small/partially obscured text.
6. Inspect browser network activity to confirm that the image itself is not
   sent to a remote application endpoint and that OCR assets load from the
   SnapWell web origin rather than an external OCR CDN. Record which core
   variant was fetched and the total transferred bytes on first load, so the
   estimate in "Asset footprint" can be replaced with a measurement.

## Results log

The six screenshots below are the complete evidence set for this update. They
are stored in `src/spike-b-results/` and were captured on an iPhone 16 Pro;
the browser version was not recorded. Each result uses a manually selected
text region and the displayed total time includes the local OCR work.

| Evidence | Selected text | Total | Confidence | Outcome | Observation |
|---|---|---:|---:|---|---|
| [1-a.jpg](../src/spike-b-results/1-a.jpg) | Sole Mare front-label product text | 85 ms | 93.0% | Usable | Appended OCR text correctly captured `SOLE MARE`, `MACKEREL FILLETS`, and `IN OLIVE OIL`. |
| [1-b.jpg](../src/spike-b-results/1-b.jpg) | Sole Mare ingredients and allergen panel | 138 ms | 83.0% | Usable | Ingredient list and `Contains Fish` matched the label closely. |
| [2-a.jpg](../src/spike-b-results/2-a.jpg) | Kehoe's stylised brand mark | 166 ms | 41.0% | Not usable without correction | The handwritten/artistic logo was not recognised reliably. |
| [2-b.jpg](../src/spike-b-results/2-b.jpg) | Kehoe's ingredients and allergen panel | 152 ms | 64.0% | Partly usable | Key ingredient words were recovered, but adjacent text and character errors were introduced on the curved, reflective label. |
| [3-a.jpg](../src/spike-b-results/3-a.jpg) | Farmers Union Greek Style product text | 191 ms | 65.0% | Partly usable | `GREEK` and `All Natural Yogurt` were readable; `STYLE` contained an extra incorrect character. |
| [3-b.jpg](../src/spike-b-results/3-b.jpg) | Farmers Union ingredients and allergen panel | 206 ms | 93.0% | Usable | The selected ingredients and `CONTAINS MILK` text were reproduced closely. |

### Findings

- Across these six captured runs, total OCR time was **85–206 ms** (mean about
  **156 ms**). This is a small convenience sample, not a formal latency
  benchmark.
- Focused crops of regular, high-contrast printed text were usable in all three
  clear label-panel examples (`1-a`, `1-b`, and `3-b`).
- OCR is still unstable for **artistic fonts, glare, and curved labels**. The
  Kehoe's brand mark was unusable, and the curved Kehoe's ingredients crop
  needed correction.
- Displayed confidence is useful as a signal but not proof of correctness:
  `3-a` had 65.0% confidence and mostly useful text, whereas every recognised
  string must remain editable before later product or ingredient matching.

## Acceptance criteria

- A clear package image produces readable product/label text in a mobile
  browser.
- The editable recognised text, confidence, and elapsed time are displayed.
- Users can correct the text before it is used by later recommendation stages.
- No user image is uploaded by the SnapWell application.

## Known limitations

- OCR reads visible text; it does not yet map a brand or product string to a
  canonical food-database item.
- Performance and accuracy depend heavily on lighting, focus, glare, label
  angle, text size, contrast, and typography. Artistic fonts, glare, and curved
  labels remain unstable.
- The current validation uses English only. Product matching and OCR/YOLO
  result fusion belong to Sprint 2.
