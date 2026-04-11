import { useEffect, useState, type FormEvent } from "react";
import { Check, KeyRound, Link2, Loader2, Mail, Share2, Users, X } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Item } from "@/store/types";
import type { ItemShareRecipient } from "./types";
import { sharePermissionSelectClass } from "./constants";
import { shareResultAlertVariant } from "./utils";

type Props = {
  open: boolean;
  item: Item | null;
  shareEmail: string;
  sharePermission: "read" | "write" | "admin";
  shareResult: string | null;
  shareRecipients: ItemShareRecipient[];
  shareRecipientsLoading: boolean;
  removingShareId: string | null;
  onOpenChange: (open: boolean) => void;
  onShareEmailChange: (v: string) => void;
  onPermissionChange: (v: "read" | "write" | "admin") => void;
  onSubmit: (e: FormEvent) => void;
  onCancel: () => void;
  onCopyItemLink: () => void;
  onRemoveShare: (shareId: string) => void;
};

export function ShareDialog({
  open,
  item,
  shareEmail,
  sharePermission,
  shareResult,
  shareRecipients,
  shareRecipientsLoading,
  removingShareId,
  onOpenChange,
  onShareEmailChange,
  onPermissionChange,
  onSubmit,
  onCancel,
  onCopyItemLink,
  onRemoveShare,
}: Props) {
  const [linkCopied, setLinkCopied] = useState(false);

  useEffect(() => {
    if (!open) setLinkCopied(false);
  }, [open]);

  const handleCopyItemLink = () => {
    onCopyItemLink();
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate">Share “{item?.name}”</span>
          </DialogTitle>
          <DialogDescription>
            See who has access, remove people, or invite someone new by email. Use “Copy link to item” to copy a
            dashboard URL to this file or folder.{" "}
            <strong>Public</strong> files or empty folders: anyone can open them without an account (read-only table and
            preview). <strong>Public folder:</strong> this folder and everything nested inside becomes public at all
            levels; making it private does the reverse for the whole tree. <strong>Private</strong> items: only you and
            invited emails who are signed in.
          </DialogDescription>
          {item?.item_type === "folder" ? (
            <p className="rounded-md border border-dashed bg-muted/50 px-3 py-2 text-sm text-foreground/90">
              Invited people can open this folder and everything inside it — all files and nested folders. The permission
              you choose applies to the whole tree under this folder.
            </p>
          ) : null}
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-2 text-foreground">
              <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
              People with access
            </Label>
            {shareRecipientsLoading ? (
              <div className="flex items-center gap-2 rounded-md border border-dashed px-3 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" aria-hidden />
                Loading…
              </div>
            ) : shareRecipients.length === 0 ? (
              <p className="rounded-md border border-dashed px-3 py-3 text-sm text-muted-foreground">
                No collaborators yet. Add an email below to invite someone.
              </p>
            ) : (
              <ul className="max-h-52 overflow-y-auto rounded-md border">
                {shareRecipients.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 border-b px-3 py-2.5 text-sm last:border-b-0"
                  >
                    <span className="min-w-0 truncate font-medium" title={r.email}>
                      {r.email}
                    </span>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Badge variant="secondary" className="tabular-nums capitalize">
                        {r.permission}
                      </Badge>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        title="Remove access"
                        aria-label={`Remove access for ${r.email}`}
                        disabled={removingShareId === r.id}
                        onClick={() => onRemoveShare(r.id)}
                      >
                        {removingShareId === r.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        ) : (
                          <X className="h-4 w-4" aria-hidden />
                        )}
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="share-email" className="inline-flex items-center gap-2">
              <Mail className="h-4 w-4 text-muted-foreground" aria-hidden />
              Invite by email
            </Label>
            <Input
              id="share-email"
              value={shareEmail}
              onChange={(e) => onShareEmailChange(e.target.value)}
              type="email"
              placeholder="user@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="share-permission" className="inline-flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" aria-hidden />
              Permission
            </Label>
            <select
              id="share-permission"
              className={cn(sharePermissionSelectClass)}
              value={sharePermission}
              onChange={(e) => onPermissionChange(e.target.value as "read" | "write" | "admin")}
            >
              <option value="read">read</option>
              <option value="write">write</option>
              <option value="admin">admin</option>
            </select>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCopyItemLink}
              className={cn(
                "min-w-[10.5rem] gap-2",
                linkCopied && "border-green-600/50 bg-green-600/10 text-green-700 dark:text-green-400",
              )}
            >
              {linkCopied ? (
                <>
                  <Check className="h-4 w-4 shrink-0" aria-hidden />
                  Copied
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4 shrink-0" aria-hidden />
                  Copy link to item
                </>
              )}
            </Button>
          </div>
          {shareResult ? (
            <Alert variant={shareResultAlertVariant(shareResult)}>
              <AlertDescription className="break-all">{shareResult}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
