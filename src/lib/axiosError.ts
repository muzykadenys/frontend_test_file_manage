import axios from "axios";

export function axiosErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const d = err.response?.data as { message?: string | string[] } | undefined;
    if (d?.message !== undefined) {
      if (typeof d.message === "string") return d.message;
      if (Array.isArray(d.message)) return d.message.join(", ");
    }
    if (err.response?.status) {
      return `${err.message} (${err.response.status})`;
    }
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err ?? "Error");
}
