// Export DOM elements as PNG images for sharing.
// Uses html2canvas under the hood. Falls back gracefully if the browser blocks
// the conversion (e.g. tainted canvas).

import html2canvas from "html2canvas";

// Export a DOM node to a PNG data URL (base64). Returns null on failure.
export async function exportNodeToPng(node, { scale = 2, background = "#0a0a0c" } = {}) {
  if (!node) return null;
  try {
    const canvas = await html2canvas(node, {
      backgroundColor: background,
      scale,
      useCORS: true,
      logging: false,
      allowTaint: false,
    });
    return canvas.toDataURL("image/png");
  } catch (err) {
    return null;
  }
}

// Trigger a browser download of a data URL.
export function downloadDataUrl(dataUrl, filename = "draft.png") {
  if (!dataUrl) return;
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Try to share via the Web Share API (mobile). Falls back to download.
export async function shareImage(dataUrl, { title = "Draft Builder", text = "Bu kadromu yenebilir misin?", filename = "draft.png" } = {}) {
  if (!dataUrl) return false;
  try {
    if (navigator.canShare && navigator.share) {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const file = new File([blob], filename, { type: "image/png" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title, text });
        return true;
      }
    }
  } catch (_) {
    /* fall through to download */
  }
  downloadDataUrl(dataUrl, filename);
  return false;
}

// Copy a string (e.g. share URL) to the clipboard.
export async function copyToClipboard(text) {
  if (!text) return false;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (_) {
    return false;
  }
}

// Build Twitter & WhatsApp share URLs.
export function tweetUrl(text, url) {
  const q = new URLSearchParams({ text, url }).toString();
  return `https://twitter.com/intent/tweet?${q}`;
}
export function whatsappUrl(text, url) {
  const q = encodeURIComponent(`${text} ${url}`);
  return `https://wa.me/?text=${q}`;
}
