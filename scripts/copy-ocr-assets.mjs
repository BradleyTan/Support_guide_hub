// Copies the screenshot-reading engine (tesseract.js) into public/ocr so the app serves it itself and no third-party
// site is contacted. Runs before dev and build; public/ocr is not committed. tests/ocr.test.ts checks the sources exist.
import { copyFileSync, mkdirSync } from "node:fs";

export const OCR_ASSETS = [
  "node_modules/tesseract.js/dist/worker.min.js",
  // One of these is picked at run time, depending on what the browser supports.
  "node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js",
  "node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js",
  "node_modules/tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js",
  "node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz",
];

const to = "public/ocr";

if (process.argv[1]?.endsWith("copy-ocr-assets.mjs")) {
  mkdirSync(to, { recursive: true });
  for (const f of OCR_ASSETS) copyFileSync(f, `${to}/${f.split("/").pop()}`);
  console.log(`Copied ${OCR_ASSETS.length} files to ${to}`);
}
