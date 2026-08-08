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

## Spike B: Local package-label OCR

**Overview**
Spike B validates browser-based OCR for packaged-food labels. Tesseract.js runs
locally in the browser: users choose a photo from the camera or photo library,
or drag and drop a photo on desktop, then draw a box around any package text
they want to read. The selected region is resized to a longest edge of at most
1600 pixels, then prepared both as a colour-aware contrast-enhanced image and
as a binary image. Both are read locally and the higher-confidence result is
shown. The page shows the recognised package text in one editable field. Users can read multiple
regions, such as a brand, product name, ingredients, or allergen warning; each
result is appended to that editable field for review.

No image is uploaded by the SnapWell application. The Tesseract worker, core,
and English language data are served from this project's `/tesseract/` assets,
not a third-party OCR CDN. Two figures matter here and should not be confused:
the checked-in assets total about 22 MB because all three core compatibility
variants are included, but a browser downloads only one of them, so the
first-load cost is about 7 MB. It is normally cached after first use. See
`docs/spike-b-results.en.md` for the breakdown.

**Run and test**

1. Run the same project setup shown in Spike A above.
2. On desktop, choose an image or drag a package photo into the dashed upload
   area. On mobile, choose a photo from the camera or photo library.
3. Drag a box around any readable label text, then select **Read selected text
   locally**. Repeat with another region if needed.
4. Review or correct the editable recognised text before it is passed to a
   later ingredient-matching stage.

For best results, use a close, front-facing and evenly lit photo. Glare, curved
packaging, very small text, or unrelated text on the label will reduce OCR
accuracy. Two local preprocessing passes improve low-contrast labels, but they
also make each OCR request slower.

**Current validation**

The current evidence set contains six iPhone 16 Pro runs stored in
`src/spike-b-results/`. Focused crops of regular printed product and ingredient
text were usable in 85–206 ms; artistic brand lettering and curved/reflective
labels needed correction. See `docs/spike-b-results.en.md` for the linked
evidence and full observations.

<img width="1179" height="2109" alt="1-a" src="https://github.com/user-attachments/assets/f941c32b-d395-4ee4-a870-cc9090587183" />


<img width="1179" height="1764" alt="1-b" src="https://github.com/user-attachments/assets/4f9cd174-6af6-452e-9566-81c1cb062fab" />

**Next steps, aligned with the timeline**

1. **Sprint 1 (10–23 August) — make a minimum end-to-end flow.** Move the
   spikes into the React user-flow skeleton; add camera/photo-library upload
   and a 640×640 canvas preview; show the YOLO result as an editable ingredient
   list; and connect that confirmed list to a small rule-based recipe matcher
   (about 20 structured recipes). The milestone is a phone photo of fruit or
   vegetables leading to an editable list and a local recipe recommendation.
2. **Start data collection during Sprint 1, in parallel.** Collect Coles and
   Woolworths catalogue images plus permitted in-store photos; label them in
   Roboflow; cover the first 50 priority food classes with about 30–50 images
   per class. This labelled set is the input for the Sprint 2 custom detector,
   not a task deferred until after the UI is finished.


**Scope note:** Spike A and Spike B currently appear on one page as independent
technical validations; their outputs are not yet fused into a product pipeline.
The current OCR intentionally does not infer separate brand, product, or
ingredient fields from noisy text. It preserves each user-selected text region
in one editable field for confirmation. Product mapping and a more robust panel
detector remain later work.
