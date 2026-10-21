import { MAX_IMAGE } from "./core.mjs";
// Canvas re-encodes images: strips EXIF/location and excludes SVG/script payloads.
export async function preparePhoto(file) {
  if (
    !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
    file.size > 15 * 1024 * 1024
  )
    throw Error("15 MB altında JPG, PNG veya WebP fotoğraf seçin.");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || img.naturalWidth * img.naturalHeight > 60000000)
      throw Error("Fotoğraf boyutu desteklenmiyor.");
    const canvas = document.createElement("canvas");
    let size = 1280;
    for (let n = 0; n < 5; n++) {
      const scale = Math.min(
        1,
        size / Math.max(img.naturalWidth, img.naturalHeight),
      );
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = canvas.toDataURL("image/jpeg", 0.78);
      if (data.length <= MAX_IMAGE) return data;
      size = Math.round(size * 0.75);
    }
    throw Error("Fotoğraf küçültülemedi. Başka bir fotoğraf seçin.");
  } finally {
    URL.revokeObjectURL(url);
  }
}
