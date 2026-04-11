import { File, Folder } from "lucide-react";

export function ItemTypeIcon({ type }: { type: string }) {
  if (type === "folder") {
    return <Folder className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />;
  }
  return <File className="h-4 w-4 shrink-0 text-sky-600" aria-hidden />;
}
