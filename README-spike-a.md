# Spike A: YOLOv8n in-browser inference (ONNX Runtime Web)

Status: ✅ validated 2026-08-07. Results: see docs/spike-a-results.en.md

## Run it (all platforms)

Prereq: Node.js ≥ 20 (https://nodejs.org, LTS installer works for
macOS and Windows). No Python needed — the exported model
(web/public/models/yolov8n.onnx) and the wasm runtime
(web/public/ort/*.wasm) are committed in this repo.

    cd web
    npm install
    npm run dev -- --host

Open http://localhost:5173, wait for "model loaded", pick a photo
containing a banana / apple / orange / broccoli / carrot / pizza
(COCO pre-trained classes).

## Test on your phone

1. Phone and computer on the SAME Wi-Fi.
2. Use the "Network" URL that vite prints (e.g. http://192.168.x.x:5173).
   On macOS ignore bridge100/101 lines (Parallels virtual adapters).
3. **Windows:** the first time you run the dev server, Windows Firewall
   will pop up — tick "Private networks" and Allow. If you missed it:
   Settings → Network → Windows Firewall → Allow an app → enable
   Node.js for Private. If the phone still can't connect, check the
   Wi-Fi is marked "Private" not "Public".
4. **Android:** open the URL in Chrome. Record model-load time and
   inference time, add a row to docs/spike-a-results.en.md.

## Re-export the model (optional, only if you change it)

    conda create -n csit998 python=3.11 -y
    conda activate csit998
    pip install ultralytics onnx onnxslim onnxruntime
    yolo export model=yolov8n.pt format=onnx opset=12 imgsz=640 simplify=True
    # then copy yolov8n.onnx into web/public/models/

## Known integration notes

- onnxruntime-web is aliased to ort.wasm.bundle.min.mjs in
  web/vite.config.js — do NOT change this to the default entry,
  the dev server will break (see docs/spike-a-results.en.md, Finding 2).
- NMS is implemented in JS (web/src/main.js) because YOLOv8's ONNX
  export has no NMS built in.
