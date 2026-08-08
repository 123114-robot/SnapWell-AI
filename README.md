# SnapWell-AI

## Spike A:
**Overview**
Completed Spike A validation for in-browser ONNX inference (YOLOv8n × ONNX Runtime Web). This PR sets up the foundational web demo, configurations, and baseline documentation.

**Instructions for Team Members (Windows / All Platforms)**
If you are on Windows (or testing on Android), here is all you need to do to run and test locally:

1. **Prerequisites**: Install Node.js LTS from the [official website](https://nodejs.org/) (standard installer, next -> next).
2. **Setup & Run**:
```bash
git clone <repo-url>
cd web
npm install
npm run dev -- --host

```


3. **Mobile Testing**:
* Connect your phone to the same Wi-Fi as your PC.
* Open the `Network` URL printed by Vite in your mobile browser.
* *Windows note*: Allow Node.js through **Private Networks** when the Windows Firewall prompt appears.


4. **Android Testing**:
* Open the URL in Chrome on an Android device.
* Record the model load and inference times, then append a row to `docs/spike-a-results.en.md` (this completes the first open item for Android validation).
<img width="236" height="235" alt="apple" src="https://github.com/user-attachments/assets/1ab31cf0-e1dc-4c37-9ac9-42ff6bfda17c" />
<img width="721" height="1568" alt="Iphone-Safari" src="https://github.com/user-attachments/assets/c0dcce6c-d83b-4cfa-85fe-08c51a4c8902" />
<img width="965" height="1232" alt="Mac-Chrome" src="https://github.com/user-attachments/assets/f8b58dc1-25b7-4882-bb52-564b26c91133" />
