/** Client-side limit (must match backend `MAX_UPLOAD_FILE_SIZE_MB`). Default 10 MB. */
export function getMaxUploadBytes(): number {
  const mb = parseFloat(process.env.NEXT_PUBLIC_MAX_UPLOAD_FILE_SIZE_MB ?? '10');
  if (Number.isFinite(mb) && mb > 0) return Math.floor(mb * 1024 * 1024);
  return 10 * 1024 * 1024;
}

export function getMaxUploadMbLabel(): string {
  const mb = parseFloat(process.env.NEXT_PUBLIC_MAX_UPLOAD_FILE_SIZE_MB ?? '10');
  if (Number.isFinite(mb) && mb > 0) return String(mb);
  return '10';
}
