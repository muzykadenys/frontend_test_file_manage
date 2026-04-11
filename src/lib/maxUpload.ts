/** Must match backend `MAX_UPLOAD_FILE_SIZE_MB` in backend `.env`. */
export const MAX_UPLOAD_FILE_SIZE_MB = 10;

export function getMaxUploadBytes(): number {
  return Math.floor(MAX_UPLOAD_FILE_SIZE_MB * 1024 * 1024);
}

export function getMaxUploadMbLabel(): string {
  return String(MAX_UPLOAD_FILE_SIZE_MB);
}
