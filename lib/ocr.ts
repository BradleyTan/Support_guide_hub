import type { Worker } from "tesseract.js";

/**
 * Reads the text in a screenshot, entirely in the browser: the image is never uploaded. The engine files are served
 * by the app itself from /ocr (see scripts/copy-ocr-assets.mjs) and load on first use only.
 */
const OCR_PATH = "/ocr";
const LSTM_ONLY = 1;

let engine: Promise<Worker> | null = null;

function loadEngine(): Promise<Worker> {
  engine ??= import("tesseract.js")
    .then(({ createWorker }) =>
      createWorker("eng", LSTM_ONLY, { workerPath: `${OCR_PATH}/worker.min.js`, corePath: OCR_PATH, langPath: OCR_PATH, gzip: true, workerBlobURL: false }),
    )
    .catch((e: unknown) => {
      // Let the next screenshot try again instead of keeping a broken engine.
      engine = null;
      throw e;
    });
  return engine;
}

export async function readScreenshotText(image: Blob): Promise<string> {
  const worker = await loadEngine();
  const { data } = await worker.recognize(image);
  return data.text;
}
