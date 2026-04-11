import {
  Check,
  Copy,
  Download,
  Eye,
  Image as ImageIcon,
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

type Props = {
  list: Item[];
  /** Rows shown while upload is in progress (optimistic). */
  pendingUploads: { clientId: string; name: string }[];
  currentUserId: string | null;
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
          <TableHead>
            <span className="inline-flex items-center gap-2">
              <ImageIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
              Type
            </span>
          </TableHead>
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
            <TableCell>
              <span className="inline-flex items-center gap-2 text-muted-foreground">
                <ItemTypeIcon type="file" />
                file
              </span>
            </TableCell>
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
                  onClick={() => (it.item_type === "folder" ? onNavigateFolder(it) : onOpenPreview(it))}
                >
                  <ItemTypeIcon type={it.item_type} />
                  <span className="truncate">{it.name}</span>
                </Button>
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-2 capitalize text-muted-foreground">
                  <ItemTypeIcon type={it.item_type} />
                  {it.item_type}
                </span>
              </TableCell>
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
              <TableCell className="text-right">
                <div className="flex flex-wrap justify-end gap-1">
                  {it.item_type === "file" ? (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      className={cn(actionBtn, "h-8 w-8 shrink-0")}
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
                      onClick={() => onTogglePublic(it.id, it.is_public)}
                      title={
                        it.is_public
                          ? "Make private — only you and invited people"
                          : "Make public — anyone with the link can open (no account required)"
                      }
                      aria-label={it.is_public ? "Make private" : "Make public"}
                    >
                      {togglingPublicId === it.id ? (
                        <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                      ) : it.is_public ? (
                        <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <Unlock className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
                      )}
                    </Button>
                  ) : null}
                      {showRename ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className={actionBtn}
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
