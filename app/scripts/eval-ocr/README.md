# Packaged-food OCR and barcode evaluation

Reproduces Sections 5.4 and 5.5 of the A3 report. It runs the app's own OCR, keyword-matching and barcode modules in a browser over a folder of package photos.

The photos themselves are not in the repository: they are team members' own supermarket photographs. The folder needs:

| File | Content |
|---|---|
| `manifest.json` | `{ "items": [{ "file", "category", "expected", "channel" }] }`. `expected` is the correct ingredient label, and `channel` is `ocr` or `vision` |
| `<category>/<photo>` | The photos listed in the manifest |
| `annotations-ocr.csv` | One row per `ocr`-channel photo: `file, expected, keyword_printed, reason_if_not, orientation, note` (written by hand) |

## Run

```bash
cd app
OCR_EVAL_DIR=/path/to/photos npx vite --config scripts/eval-ocr/vite.config.js
```

Open `http://localhost:5199/scripts/eval-ocr/index.html`. Add `?channel=ocr` or `?limit=10` to run a subset. Results collect in `window.__ocrEval.results`; save them as `ocr-eval-results.json` in the photo folder.

Each photo is processed in three configurations (pass 1 only, the two-pass scan the app ships, and whole-image recognition) and through the barcode decoder at four rotations.

## Analyse

```bash
python3 scripts/eval-ocr/analyse.py /path/to/photos --out <report>/figures
```

This prints the summary used in the report and draws `ocr_outcomes.pdf`.
