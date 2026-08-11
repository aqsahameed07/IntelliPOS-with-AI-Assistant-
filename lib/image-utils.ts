/** Client-side image helpers: keep stored images small so localStorage never overflows. */

const MAX_DIM = 900;
const QUALITY = 0.78;

/** Read a File and return a downscaled JPEG/PNG data URL suitable for localStorage. */
export function compressImageFile(file: File, maxDim = MAX_DIM, quality = QUALITY): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read file"));
    reader.onload = () => {
      const raw = String(reader.result);
      const img = new Image();
      img.onerror = () => resolve(raw);
      img.onload = () => {
        try {
          const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(raw);
          ctx.drawImage(img, 0, 0, w, h);
          const hasAlpha = file.type === "image/png" || file.type === "image/webp";
          const out = canvas.toDataURL(hasAlpha ? "image/webp" : "image/jpeg", quality);
          resolve(out.length < raw.length ? out : raw);
        } catch {
          resolve(raw);
        }
      };
      img.src = raw;
    };
    reader.readAsDataURL(file);
  });
}

/** True for anything we can safely drop into an <img src>. */
export function isDisplayableImage(src?: string) {
  if (!src) return false;
  return /^(data:image\/|https?:\/\/|\/|blob:)/.test(src.trim());
}
