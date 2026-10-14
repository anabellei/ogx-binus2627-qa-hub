export const sanitize = (s: string) =>
  s.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim().slice(0, 120);

export function itemSlug(label: string): string {
  return label
    .replace(/\(if change\)/i, "")
    .replace(/['’`]/g, "")
    .replace(/[^A-Za-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .join("-")
    .slice(0, 60);
}

export function itemFolderName(label: string): string {
  return sanitize(label.replace(/\(if change\)\s*/i, "").replace(/\s*\/\s*/g, " - "));
}

const ascii = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 -]/g, "");
const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w);

export function shortNames(names: string[]): string[] {
  const first = names.map((n) => cap(ascii(n).split(" ").filter(Boolean)[0] ?? "EP"));
  return names.map((n, i) => {
    if (first.filter((f) => f === first[i]).length === 1) return first[i];
    const parts = ascii(n).split(" ").filter(Boolean).map(cap);
    return parts.slice(0, 2).join("-");
  });
}

const MIME_EXT: Record<string, string> = {
  "application/pdf": ".pdf", "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp",
  "image/heic": ".heic", "video/mp4": ".mp4", "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
};
export function fileExt(name: string, mime: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  if (m) return "." + m[1].toLowerCase().replace("jpeg", "jpg");
  return MIME_EXT[mime] ?? "";
}
