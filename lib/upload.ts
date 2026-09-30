"use client";

import { supabaseBrowser } from "@/lib/supabase/client";
import { COMPRESS_OVER_MB } from "@/lib/files";

const MAX_EDGE = 2400;

/** Shrinks large PNG/JPEG/WEBP screenshots to at most 2400px and ~JPEG quality 0.85. Small files and PDFs pass through. */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= COMPRESS_OVER_MB * 1024 * 1024) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // unreadable image: upload as-is rather than fail
  }
}

function safeName(name: string) {
  return name.replace(/[^\w.\-]+/g, "_").slice(-100) || "file";
}

/** Uploads to private storage at <userId>/<guideId>/<random>-<name>. Returns the storage path and attachment details. */
export async function uploadAttachment(userId: string, guideId: string, original: File) {
  const file = await compressImage(original);
  const path = `${userId}/${guideId}/${crypto.randomUUID()}-${safeName(file.name)}`;
  const { error } = await supabaseBrowser().storage.from("attachments").upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw new Error(error.message);
  return {
    path,
    name: file.name.slice(0, 200),
    kind: file.type === "application/pdf" ? ("pdf" as const) : ("image" as const),
    sizeBytes: file.size,
  };
}
