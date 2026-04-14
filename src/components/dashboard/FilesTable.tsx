import {
  Check,
  Copy,
  Download,
  Eye,
  LayoutGrid,
  Link2,
  Loader2,
  Lock,
  Pencil,
  Share2,
  Trash2,
  Unlock,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { Item, ItemRole } from "@/store/types";
import { ItemTypeIcon } from "./ItemTypeIcon";

const actionBtn =
  "cursor-pointer shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring";

/** Rows use `draggable` for reorder; without this, the browser can swallow clicks on nested controls. */
function stopRowDragMouseDown(e: React.MouseEvent) {
  e.stopPropagation();
}

function ownerLabel(item: Item, currentUserId: string | null): string {
  if (currentUserId && item.owner_id === currentUserId) return "You";
  const e = item.owner_email?.trim();
  return e || "—";
}

function itemRole(item: Item): ItemRole {
  return item.my_role ?? "owner";
}

function canManage(item: Item): boolean {
  return item.can_manage !== false;
}

function canRename(item: Item): boolean {
  const r = itemRole(item);
  return r === "owner" || r === "write" || r === "admin";
}

function isOwner(item: Item): boolean {
  return itemRole(item) === "owner";
}

const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg", ".bmp", ".ico", ".heic", ".avif"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov", ".avi", ".mkv", ".m4v", ".ogv"]);

function extensionFromFileName(name: string): string {
  const i = name.lastIndexOf(".");
  if (i <= 0) return "";
  return name.slice(i).toLowerCase();
}

/** Column "Type": folder, image, video, or other files (by mime when known). */
function itemTypeColumnLabel(item: Item): string {
  if (item.item_type === "folder") return "Folder";
  const mime = (item.mime_type || "").toLowerCase().trim();
  if (mime.startsWith("image/")) return "Image";
  if (mime.startsWith("video/")) return "Video";
  return "Other file";
}

function pendingUploadTypeLabel(fileName: string): string {
  const ext = extensionFromFileName(fileName);
  if (IMAGE_EXT.has(ext)) return "Image";
  if (VIDEO_EXT.has(ext)) return "Video";
  return "Other file";
}

type Props = {
  list: Item[];
  /** Rows shown while upload is in progress (optimistic). */
  pendingUploads: { clientId: string; name: string }[];
  currentUserId: string | null;
  /** Block opening folders while list is loading (avoids duplicate crumbs / races). */
  navigationLocked?: boolean;
  allowReorder: boolean;
  togglingPublicId: string | null;
  cloningId: string | null;
  copiedItemId: string | null;
  onNavigateFolder: (item: Item) => void;
  onOpenPreview: (item: Item) => void;
  onShare: (item: Item) => void;
  onTogglePublic: (id: string, isPublic: boolean) => void;
  onRenameClick: (item: Item) => void;
  onClone: (id: string) => void;
  onDeleteClick: (item: Item) => void;
  onDownload: (item: Item) => void;
  onDragStart: (id: string) => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (targetId: string) => void;
  onCopyUrl: (item: Item) => void;
};

export function FilesTable({
  list,
  pendingUploads,
  currentUserId,
  navigationLocked = false,
  allowReorder,
  togglingPublicId,
  cloningId,
  copiedItemId,
  onNavigateFolder,
  onOpenPreview,
  onShare,
  onTogglePublic,
  onRenameClick,
  onClone,
  onDeleteClick,
  onDownload,
  onDragStart,
  onDragOver,
  onDrop,
  onCopyUrl,
}: Props) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-[32%]">
            <span className="inline-flex items-center gap-2">
              <LayoutGrid className="h-4 w-4 text-muted-foreground" aria-hidden />
              Name
            </span>
          </TableHead>
          <TableHead>Type</TableHead>
          <TableHead title="Public: anyone with the link can open (no account needed). Private: only you and invited people.">
            <span className="inline-flex items-center gap-2">
              <Eye className="h-4 w-4 text-muted-foreground" aria-hidden />
              Visibility
            </span>
          </TableHead>
          <TableHead>
            <span className="inline-flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" aria-hidden />
              Owner
            </span>
          </TableHead>
          <TableHead className="text-right">
            <span className="inline-flex items-center justify-end gap-2">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {pendingUploads.map((p) => (
          <TableRow
            key={p.clientId}
            className="border-b opacity-60"
            aria-busy
            aria-label={`Uploading ${p.name}`}
          >
            <TableCell>
              <span className="inline-flex max-w-full items-center gap-2">
                <ItemTypeIcon type="file" />
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" aria-hidden />
                <span className="min-w-0 truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">Uploading…</span>
              </span>
            </TableCell>
            <TableCell className="text-muted-foreground">{pendingUploadTypeLabel(p.name)}</TableCell>
            <TableCell>
              <span className="text-sm text-muted-foreground">—</span>
            </TableCell>
            <TableCell className="max-w-[12rem] truncate text-muted-foreground">
              {currentUserId ? "You" : "—"}
            </TableCell>
            <TableCell className="text-right text-sm text-muted-foreground">Not available yet</TableCell>
          </TableRow>
        ))}
        {list.map((it) => {
          const reorder = allowReorder && isOwner(it);
          const showShare = canManage(it);
          const showVisibility = canManage(it);
          const showRename = canRename(it);
          const showCloneDelete = isOwner(it);
          return (
            <TableRow
              key={it.id}
              draggable={reorder}
              className="border-b transition-none hover:bg-transparent"
              onDragStart={reorder ? () => onDragStart(it.id) : undefined}
              onDragOver={reorder ? onDragOver : undefined}
              onDrop={reorder ? () => onDrop(it.id) : undefined}
            >
              <TableCell>
                <Button
                  type="button"
                  variant="link"
                  className="h-auto max-w-full cursor-pointer justify-start gap-2 p-0 font-normal hover:no-underline"
                  disabled={it.item_type === "folder" && navigationLocked}
                  onMouseDown={reorder ? stopRowDragMouseDown : undefined}
                  onClick={() => (it.item_type === "folder" ? onNavigateFolder(it) : onOpenPreview(it))}
                >
                  <ItemTypeIcon type={it.item_type} />
                  <span className="truncate">{it.name}</span>
                </Button>
              </TableCell>
              <TableCell className="text-muted-foreground">{itemTypeColumnLabel(it)}</TableCell>
              <TableCell>
                <Badge
                  variant={it.is_public ? "secondary" : "outline"}
                  className="gap-1"
                  title={
                    it.is_public
                      ? "Public: anyone with the link can open this item (no account required)."
                      : "Private: only you and people invited by email can open this item."
                  }
                >
                  {it.is_public ? (
                    <Unlock className="h-3 w-3 text-green-600 dark:text-green-400" aria-hidden />
                  ) : (
                    <Lock className="h-3 w-3 text-muted-foreground" aria-hidden />
                  )}
                  {it.is_public ? "public" : "private"}
                </Badge>
              </TableCell>
              <TableCell
                className={cn(
                  "max-w-[12rem] truncate",
                  ownerLabel(it, currentUserId) === "You" ? "font-medium text-foreground" : "text-muted-foreground",
                )}
                title={ownerLabel(it, currentUserId)}
              >
                {ownerLabel(it, currentUserId)}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                <div className="flex flex-nowrap justify-end gap-1">
                  {it.item_type === "file" ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className={cn(actionBtn, "h-8 w-8 shrink-0")}
                      onMouseDown={stopRowDragMouseDown}
                      onClick={() => onDownload(it)}
                      title="Download file"
                      aria-label="Download file"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className={cn(
                      actionBtn,
                      "h-8 w-8 shrink-0",
                      copiedItemId === it.id && "border-green-600/50 bg-green-600/10 text-green-700 dark:text-green-400",
                    )}
                    onMouseDown={stopRowDragMouseDown}
                    onClick={() => onCopyUrl(it)}
                    title={
                      copiedItemId === it.id
                        ? "Copied"
                        : it.is_public
                          ? "Copy link (public — works without an account)"
                          : "Copy link (private — only you and invited people)"
                    }
                    aria-label={copiedItemId === it.id ? "Copied" : "Copy link to this item"}
                  >
                    {copiedItemId === it.id ? (
                      <Check className="h-3.5 w-3.5" aria-hidden />
                    ) : (
                      <Link2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                  </Button>
                  {showShare ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      className={actionBtn}
                      onMouseDown={stopRowDragMouseDown}
                      onClick={() => onShare(it)}
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </Button>
                  ) : null}
                  {showVisibility ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className={cn(actionBtn, "h-8 w-8 shrink-0")}
                      disabled={togglingPublicId === it.id}
                      onMouseDown={stopRowDragMouseDown}
                      onClick={() => onTogglePublic(it.id, it.is_public)}
                      title={
                        it.is_public
                          ? it.item_type === "folder"
                            ? "Make private — only you and invited people; all nested items become private at every level"
                            : "Make private — only you and invited people"
                          : it.item_type === "folder"
                            ? "Make public — anyone with the link can open; all nested files and folders become public at every level"
                            : "Make public — anyone with the link can open (no account required)"
                      }
                      aria-label={it.is_public ? "Make private" : "Make public"}
                    >
                      {togglingPublicId === it.id ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : it.is_public ? (
                        <Unlock className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      ) : (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                  ) : null}
                      {showRename ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className={actionBtn}
                          onMouseDown={stopRowDragMouseDown}
                          onClick={() => onRenameClick(it)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Rename
                        </Button>
                      ) : null}
                      {showCloneDelete ? (
                        <>
                          <Button
                            type="button"
                            size="sm"
                            variant="secondary"
                            className={cn(actionBtn, "min-w-[4.5rem]")}
                            disabled={cloningId === it.id}
                            onMouseDown={stopRowDragMouseDown}
                            onClick={() => onClone(it.id)}
                          >
                            {cloningId === it.id ? (
                              <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                            Clone
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="destructive"
                            className={cn(actionBtn, "h-8 w-8 shrink-0 hover:bg-destructive/90")}
                            onMouseDown={stopRowDragMouseDown}
                            onClick={() => onDeleteClick(it)}
                            title="Delete"
                            aria-label="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      ) : null}
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
