import type { Item } from "@/store/types";

export type Crumb = { id: string | null; name: string };

export type ItemShareRecipient = {
  id: string;
  email: string;
  permission: "read" | "write" | "admin";
  created_at?: string;
};

export type DashboardLocalState = {
  crumbs: Crumb[];
  dragId: string | null;
  shareFor: Item | null;
  shareEmail: string;
  sharePermission: "read" | "write" | "admin";
  shareResult: string | null;
  shareRecipients: ItemShareRecipient[];
  shareRecipientsLoading: boolean;
  removingShareId: string | null;
  previewUrl: string | null;
  previewName: string | null;
  /** When set, URL includes `item=` for deep links / copy link. */
  previewItemIdForUrl: string | null;
  newFolderOpen: boolean;
  newFolderName: string;
  renameTarget: Item | null;
  renameValue: string;
  deleteTarget: Item | null;
  togglingPublicId: string | null;
  cloningId: string | null;
  deletingId: string | null;
  /** Row id whose copy-link button shows a brief “copied” checkmark. */
  copiedItemId: string | null;
  /** Deep link / hydrate failed (private item or no access). */
  linkError: string | null;
  /** True while a folder navigation is in flight (covers gap before store `loading`). */
  folderNavBusy: boolean;
};
