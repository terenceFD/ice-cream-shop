// Shared by the admin upload forms. Phone photos are often several megabytes, so large stills are
// scaled down in the browser before upload (quicker on slow connections, and under the 5 MB limit).
// The server also resizes every upload, so this is about upload speed, not page speed.
// GIFs are sent as they are so animations are kept.
const MAX_DIMENSION = 1600;
const SEND_AS_IS_BYTES = 1.5 * 1024 * 1024;

export const UPLOAD_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Could not read the selected image.")));
    reader.onerror = () => reject(new Error("Could not read the selected image."));
    reader.readAsDataURL(file);
  });
}

export async function prepareImageForUpload(file: File) {
  if (file.type === "image/gif" || typeof createImageBitmap !== "function") return readFileAsDataUrl(file);
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  if (scale === 1 && file.size <= SEND_AS_IS_BYTES) {
    bitmap.close();
    return readFileAsDataUrl(file);
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return readFileAsDataUrl(file);
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  // WebP keeps transparent backgrounds; browsers that cannot encode it fall back to JPEG.
  const webp = canvas.toDataURL("image/webp", 0.85);
  return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", 0.85);
}
