export type ItemRole = 'owner' | 'read' | 'write' | 'admin';

export type Item = {
  id: string;
  parent_id: string | null;
  name: string;
  item_type: 'file' | 'folder';
  sort_order: number;
  is_public: boolean;
  owner_id: string;
  /** Set by API for display; not a DB column. */
  owner_email?: string | null;
  /** From API: access level on shared items; own items are always owner. */
  my_role?: ItemRole;
  /** Owner or share admin — can change public/private and share. */
  can_manage?: boolean;
  storage_path: string | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthState = {
  accessToken: string | null;
  user: { id: string; email?: string } | null;
  loading: boolean;
  error: string | null;
  registerSuccess: string | null;
  registerError: string | null;
};

export type FilesViewMode = 'mine' | 'shared';

export type PendingUpload = { clientId: string; name: string };

export type FilesState = {
  viewMode: FilesViewMode;
  parentId: string | null;
  items: Item[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  searchResults: Item[] | null;
  /** Optimistic rows while multipart upload is in flight (mine view only). */
  pendingUploads: PendingUpload[];
};
