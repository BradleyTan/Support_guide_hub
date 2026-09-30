/** Upload rules shared by every text/image input and the storage bucket (10 MB, see 0001_init.sql). */
export const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp", "application/pdf"];
export const MAX_FILE_MB = 10;
export const MAX_FILES = 6;
export const COMPRESS_OVER_MB = 2;

/** Validates a file against the accepted types and size limit. Returns an error message or null. */
export function validateFile(f: { name: string; type: string; size: number }) {
  if (!ACCEPTED_TYPES.includes(f.type)) return `${f.name}: this file type isn't supported. Use PNG, JPG, WEBP or PDF.`;
  if (f.size > MAX_FILE_MB * 1024 * 1024) return `${f.name} is ${(f.size / 1048576).toFixed(1)} MB. The limit is ${MAX_FILE_MB} MB per file.`;
  return null;
}
