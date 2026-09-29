# Testing gaps

The Node test suite covers the pure barcode, product-data, OCR matching,
detection post-processing, mode-selection, and recommendation rules. The
following behavior still needs browser integration or end-to-end coverage:

- camera permission granted, denied, and revoked while the app is open;
- live camera startup, switching, frame capture, and shutdown;
- barcode decoding from real camera frames and uploaded photographs;
- OCR worker/model loading and recognition against browser image APIs;
- DOM navigation and button-disabled states across capture, confirmation,
  recommendations, and recipe screens;
- persistence behavior in real browsers with blocked, private, or quota-full
  storage;
- Online mode requests against a controlled test service, including browser
  abort behavior and consent UI.

These are intentionally not simulated with a new browser-testing framework in
the current regression-coverage task.
