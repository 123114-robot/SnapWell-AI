# Spike A Validation Report: YOLOv8n × ONNX Runtime Web In-Browser Inference

**Date:** 2026-08-07 (Preparation Week, 4–9 Aug)
**Owner:** Kai Ma
**Risk level:** Highest (Project red line #1: must pass by 9 Aug,
otherwise the architecture fallback plan is triggered)
**Verdict: ✅ PASS — the Edge AI in-browser inference architecture holds**

## 1. Objective

Validate SnapWell AI's core architectural assumption: an official pre-trained
YOLOv8-nano exported to ONNX can run **inside a mobile browser** via
ONNX Runtime Web (wasm backend) with acceptable latency
(red line: if far beyond 2 s, trigger fallback — reduce input resolution
to 320 or switch to TensorFlow.js).

This also underpins the privacy-by-design commitment: photos never leave
the user's device; all inference is local.

## 2. Environment

| Item | Version / Config |
|---|---|
| Export environment | macOS (Apple M3 Pro), conda env `csit998`, Python 3.11.15 |
| ultralytics | 8.4.115 |
| PyTorch | 2.13.0 |
| onnxruntime (Python-side check) | 1.28.0 |
| onnxruntime-web | 1.28.0 (`ort.wasm.bundle.min.mjs` variant) |
| Frontend tooling | Vite 8.2.1 + vanilla JS, Node 26.7.0 |
| Model | yolov8n.pt → yolov8n.onnx (opset 12, 640×640, onnxslim, 12.3 MB) |

## 3. Method Summary

1. `yolo export model=yolov8n.pt format=onnx opset=12 imgsz=640 simplify=True`
2. Frontend: canvas letterbox preprocessing (aspect-preserving resize +
   grey padding to 640×640) → Float32 CHW normalisation → `session.run()` →
   JS decoding of the `[1,84,8400]` output → custom greedy NMS
   (IoU 0.45, confidence 0.25) → coordinates mapped back to the original
   image for box rendering
3. Timing: preprocessing / inference / postprocessing measured separately
   with `performance.now()`
4. On-device testing via LAN access to the dev server (`vite --host`)

## 4. Results

| Device | Browser | Model load (cold / LAN*) | Preproc | Inference | Postproc | Total |
|---|---|---|---|---|---|---|
| MacBook Pro (M3 Pro) | Chrome | 58 ms (cached) | 10 ms | 215 ms | 3 ms | 228 ms |
| iPhone 16 Pro | Safari | 1021 ms (private window, cold) | 13 ms | 213 ms | 3 ms | 231 ms |
| Mid-range Android (1st run) | Chrome | 898 ms | 208 ms | 2012 ms | 7 ms | 2227 ms |
| Mid-range Android (2nd run, warm) | Chrome | 186 ms | 88 ms | 393 ms | 3 ms | 484 ms |
| MacBook Air (2020 M1) | Chrome | 234 ms  | 73 ms | 277 ms | 4 ms | 353 ms |
| iPhone 17 Pro | Safari | 1331 ms | 30 ms | 186 ms | 2 ms | 218 ms |

\* LAN load times do not represent public-CDN cold starts; see Finding 5.

**Headline: 296 ms end-to-end on iPhone 16 Pro — roughly 7× margin
below the 2 s red line.**

**The mid-range Android's *first* run reached 2227 ms end-to-end, just above
the 2 s red line; its *second* run dropped to 484 ms — a 5x difference on the
same device.** This is wasm JIT warm-up: the first `session.run()` pays the
cost of compiling the wasm module, which later runs reuse. The iPhone 16 Pro
shows no comparable penalty (213 ms on a cold private-window session), so the
warm-up cost scales inversely with device capability — it is precisely the
low-end devices that suffer it.

The red line is therefore not breached in steady-state use, but the first
detection a user performs on a low-end Android would be unacceptably slow
without mitigation.

**Mitigation (scheduled for Sprint 1):** run a throwaway inference on a blank
640x640 tensor immediately after the model loads, shifting the compilation
cost into the startup window before the user has taken a photo. This must be
re-benchmarked on the same Android device to confirm the effect.

**Note on model-load figures:** early iPhone 16 Pro measurements (~250 ms)
were taken with a warm HTTP cache and are not comparable. The 1021 ms above
was measured in a Safari private window with no cached assets, which aligns
with the iPhone 17 Pro figure. All load times are LAN transfers, not
public-CDN cold starts.

## 5. Key Findings (A3 material)

1. **YOLOv8's ONNX export contains no NMS.** The output is 8,400 raw
   candidate boxes (84 = 4 coords + 80 class scores); NMS must be
   re-implemented in JavaScript. An under-documented but unavoidable
   engineering detail.
2. **Known integration friction between ONNX Runtime Web and the Vite dev
   server.** ORT loads its wasm loader (.mjs) via a runtime dynamic
   `import()`, which collides with Vite's module transform pipeline
   (files under `/public` must not be imported). After eliminating three
   approaches, the working solution is the official **bundle variant**
   (`ort.wasm.bundle.min.mjs`, loader inlined, wasm fetched normally)
   + `resolve.alias` + a single-file `wasmPaths` object. Works in both
   dev and build.
3. **Incidental optimisation:** the bundle/wasm route only needs the base
   `ort-wasm-simd-threaded.wasm` (13 MB) instead of the default jsep
   variant (26 MB) — first-load payload halved (giving up potential
   WebGPU acceleration, acceptable given the current latency margin).
4. **The pre-trained model's class limitation is now evidenced.** COCO's
   80 classes include only ~10 foods; on desktop, an apple image was
   misclassified as orange (64%) — a classic red/yellow round-fruit
   confusion — while an iPhone photo of the same apple was correctly
   detected as apple (67%). This directly supports the proposal's case
   for fine-tuning on a custom ingredient dataset (Sprint 2), and
   clarifies that Spike A validates **architecture and latency**, not
   accuracy.
5. **First load after deployment is the real UX bottleneck.** The ~250 ms
   load here is a LAN figure; production users must download 13 MB wasm +
   12 MB model from a CDN — an estimated 5–15 s on 4G. Candidate
   optimisations (Sprint 4): INT8 quantisation (12 MB → ~3 MB),
   a loading-progress UI, Service Worker caching.

## 6. Outstanding Items

- [x] Mid-range Android (2–3-year-old device) + Chrome — the biggest gap
      in the table and the true test of the wasm performance floor
- [x] Repeat inference 2–3× on the same device to record warm-up
      (wasm JIT; the second run is typically faster)
- [ ] One more row: Chrome on iPhone
- [ ] After public deployment (Vercel), record a genuine cold-start load time
- [ ] After implementing the warm-up inference, re-benchmark first-run
      latency on the same mid-range Android
