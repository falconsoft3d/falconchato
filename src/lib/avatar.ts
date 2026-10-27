// Recorta una imagen al centro y la reduce a 160×160 (data URL) para guardarla en la BD.
export async function toAvatar(file: File) {
  const img = await createImageBitmap(file);
  const size = 160;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const side = Math.min(img.width, img.height);
  canvas.getContext("2d")!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
  return canvas.toDataURL("image/webp", 0.85);
}
