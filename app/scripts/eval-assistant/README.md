# Recipe assistant evaluation

Reproduces Section 5.15 of the A3 report. It runs the app's own chat modules in Node against the real Gemini API.

| File | Purpose |
|---|---|
| `questions.json` | 48 questions in 8 categories (A–H), each tied to a user profile and a screen |
| `harness.mjs` | Serves `public/data` to the app's modules, sends outbound requests through `curl` (so `HTTPS_PROXY` is honoured), and defines the three user profiles |
| `run.mjs` | Runs every question as `grounded` (shipped pipeline, raw and verified reply kept) and `direct` (plain Gemini) |
| `score.mjs` | Automatic metrics, blinded annotation sheet, and label merging |
| `guard-stress.mjs` | Offline stress test of `verifyChatAnswer` with injected violations; makes no API calls |
| `aggregate.py` | Combines several runs, prints the summary and draws the two report figures |
| `results/` | Raw replies (`runN.jsonl`), labels, sheet keys, stress results and `summary-run1-3.json` |

## Reproduce

```bash
cd app
node scripts/eval-assistant/run.mjs run1 ../path/to/.env
BYPASS_PRECHECK=1 node scripts/eval-assistant/run.mjs run1 ../path/to/.env
node scripts/eval-assistant/score.mjs run1
node scripts/eval-assistant/guard-stress.mjs run1
node scripts/eval-assistant/score.mjs run2 --sheet run1   # reuses labels for identical answers
python3 scripts/eval-assistant/aggregate.py run1 run2 run3 --out <report>/figures
```

The `.env` file needs `VITE_GEMINI_API_KEY`. The key is never written to the results.

## Labels

The labels were written blind to condition: `score.mjs --sheet` exports answers in a shuffled order under anonymous codes, and `--labels` maps them back. Rubric per category is in `score.mjs` (`RUBRIC`). All labels were written by one annotator, and a second team member should spot-check them.
