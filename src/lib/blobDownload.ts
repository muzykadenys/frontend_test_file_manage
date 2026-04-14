/**
 * Revoking the blob URL in the same synchronous turn as <a download>.click() breaks downloads
 * in Chrome/Safari because the download task still references the URL.
 */
export function revokeBlobUrlAfterUse(url: string, ms = 60_000): void {
  if (typeof window === "undefined" || !url.startsWith("blob:")) return;
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, ms);
}

/** Characters that break `download=` or cross-platform saves. */
export function sanitizeDownloadFileName(name: string): string {
  const cleaned = name.replace(/[/\\?%*:|"<>]/g, "_").replace(/\0/g, "").trim();
  const base = cleaned || "download";
  return base.length > 180 ? base.slice(0, 180) : base;
}

/** Programmatic save: keeps filename, defers revoke so the browser can finish the download. */
export function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof window === "undefined") return;
  const safeName = sanitizeDownloadFileName(filename);
  if (blob.size === 0) {
    throw new Error("Received an empty file from the server.");
  }

  const blobUrl = URL.createObjectURL(blob);
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPad|iPhone|iPod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  // iOS Safari (and some WebViews) ignore `download` on blob: URLs — open in a new tab so the user can save/share.
  if (isIOS) {
    const win = window.open(blobUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = safeName;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
    revokeBlobUrlAfterUse(blobUrl, 120_000);
    return;
  }

  const a = document.createElement("a");
  a.href = blobUrl;
  a.setAttribute("download", safeName);
  a.rel = "noopener noreferrer";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  requestAnimationFrame(() => {
    a.remove();
    revokeBlobUrlAfterUse(blobUrl);
  });
}

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|svg|bmp|ico|heic|avif)$/i;

/** Fallback when DB mime is missing or generic (e.g. application/octet-stream). */
export function isLikelyImage(
  item: { mime_type?: string | null; name?: string },
  blob?: Pick<Blob, "type"> | null,
): boolean {
  const fromDb = (item.mime_type ?? "").toLowerCase();
  if (fromDb.startsWith("image/")) return true;
  const fromBlob = (blob?.type ?? "").toLowerCase();
  if (fromBlob.startsWith("image/")) return true;
  return IMAGE_EXT.test((item.name ?? "").toLowerCase());
}
