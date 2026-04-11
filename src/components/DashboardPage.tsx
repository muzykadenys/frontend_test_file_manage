import React from "react";
import Head from "next/head";
import { NextRouter, withRouter } from "next/router";
import type { AppStoreApi } from "@/store/appStore";
import { useAppStore } from "@/store";
import type { AuthState, FilesState, FilesViewMode, Item } from "@/store/types";
import * as api from "@/lib/api";
import type { Crumb } from "@/components/dashboard/types";
import { getMaxUploadBytes, getMaxUploadMbLabel } from "@/lib/maxUpload";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ConfirmDeleteDialog } from "@/components/dashboard/ConfirmDeleteDialog";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { DashboardToolbar } from "@/components/dashboard/DashboardToolbar";
import { FilesTable } from "@/components/dashboard/FilesTable";
import { PreviewDialog } from "@/components/dashboard/PreviewDialog";
import { ShareDialog } from "@/components/dashboard/ShareDialog";
import { TextPromptDialog } from "@/components/dashboard/TextPromptDialog";
import type { DashboardLocalState, ItemShareRecipient } from "@/components/dashboard/types";
import { buildReorderPayload, sortedVisibleList } from "@/components/dashboard/utils";

function pickQueryString(v: string | string[] | undefined): string | undefined {
  if (typeof v === "string") return v;
  if (Array.isArray(v) && v[0]) return v[0];
  return undefined;
}

/**
 * Next.js often leaves `router.query` empty on the first client paint (especially with `dynamic(..., { ssr: false })`).
 * The address bar is the reliable source for `item`, `path`, and `view`.
 */
function readDashboardQueryKeys(router: NextRouter): { view?: string; path?: string; item?: string } {
  if (typeof window !== "undefined") {
    const sp = new URLSearchParams(window.location.search);
    const fromWindow = {
      view: sp.get("view") ?? undefined,
      path: sp.get("path") ?? undefined,
      item: sp.get("item") ?? undefined,
    };
    if (fromWindow.view || fromWindow.path || fromWindow.item) {
      return fromWindow;
    }
  }
  const hi = router.asPath.indexOf("?");
  if (hi === -1) return {};
  const sp = new URLSearchParams(router.asPath.slice(hi + 1));
  return {
    view: sp.get("view") ?? undefined,
    path: sp.get("path") ?? undefined,
    item: sp.get("item") ?? undefined,
  };
}

function buildDashboardQuery(viewMode: FilesViewMode, crumbs: Crumb[], itemId?: string): Record<string, string> {
  const q: Record<string, string> = {};
  if (viewMode !== "mine") q.view = viewMode;
  const folderIds = crumbs.slice(1).map((c) => c.id).filter(Boolean) as string[];
  if (folderIds.length) q.path = folderIds.join(",");
  if (itemId) q.item = itemId;
  return q;
}

/** Same shape as `hydrateFromQuery` uses for `lastHydratedSerialized` dedup. */
function serializeUrlStateFromQuery(q: Record<string, string>): string {
  return JSON.stringify({
    viewParam: q.view,
    pathParam: q.path,
    itemParam: q.item,
  });
}

type Props = {
  router: NextRouter;
  auth: AuthState;
  files: FilesState;
  store: AppStoreApi;
};

type GuestBrowseState = {
  ready: boolean;
  items: Item[];
  loading: boolean;
  error: string | null;
};

type DashState = DashboardLocalState & { guestBrowse: GuestBrowseState };

class DashboardPageInner extends React.Component<Props, DashState> {
  private fileInputRef: React.RefObject<HTMLInputElement>;
  private ignoreNextRouteChange = false;
  private lastHydratedSerialized = "";
  private hydrateSeq = 0;

  constructor(props: Props) {
    super(props);
    this.state = {
      crumbs: [{ id: null, name: "My files" }],
      dragId: null,
      shareFor: null,
      shareEmail: "",
      sharePermission: "read",
      shareResult: null,
      previewUrl: null,
      previewName: null,
      previewItemIdForUrl: null,
      newFolderOpen: false,
      newFolderName: "",
      renameTarget: null,
      renameValue: "",
      deleteTarget: null,
      togglingPublicId: null,
      cloningId: null,
      deletingId: null,
      copiedItemId: null,
      shareRecipients: [],
      shareRecipientsLoading: false,
      removingShareId: null,
      linkError: null,
      guestBrowse: { ready: false, items: [], loading: false, error: null },
    };
    this.fileInputRef = React.createRef();
  }

  componentDidMount() {
    const { router } = this.props;
    router.events.on("routeChangeComplete", this.onRouteChangeComplete);
    if (!this.props.auth.accessToken) {
      if (router.isReady) {
        void this.hydrateGuestFromQuery();
      }
      return;
    }
    if (router.isReady) {
      void this.hydrateFromQuery();
    }
  }

  componentWillUnmount() {
    this.props.router.events.off("routeChangeComplete", this.onRouteChangeComplete);
    const { previewUrl } = this.state;
    if (previewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
  }

  componentDidUpdate(prevProps: Props, prevState: DashState) {
    if (prevState.previewUrl && prevState.previewUrl !== this.state.previewUrl && prevState.previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(prevState.previewUrl);
    }
    if (prevProps.auth.accessToken && !this.props.auth.accessToken && this.props.router.isReady) {
      this.lastHydratedSerialized = "";
      void this.hydrateGuestFromQuery();
    }
    if (prevProps.files.loading && !this.props.files.loading) {
      this.setState((s) => ({
        togglingPublicId: null,
        cloningId: null,
        deletingId: null,
        deleteTarget: s.deletingId ? null : s.deleteTarget,
      }));
    }
    if (!prevProps.router.isReady && this.props.router.isReady && this.props.auth.accessToken) {
      void this.hydrateFromQuery();
    }
    if (!prevProps.router.isReady && this.props.router.isReady && !this.props.auth.accessToken) {
      void this.hydrateGuestFromQuery();
    }
    if (!prevProps.auth.accessToken && this.props.auth.accessToken && this.props.router.isReady) {
      this.lastHydratedSerialized = "";
      this.setState({
        guestBrowse: { ready: false, items: [], loading: false, error: null },
      });
      void this.hydrateFromQuery();
    }
  }

  private onRouteChangeComplete = (url: string) => {
    if (this.ignoreNextRouteChange) {
      this.ignoreNextRouteChange = false;
      return;
    }
    const pathOnly = url.split("?")[0];
    if (pathOnly !== "/" && pathOnly !== "") return;
    if (!this.props.auth.accessToken) {
      this.lastHydratedSerialized = "";
      void this.hydrateGuestFromQuery();
      return;
    }
    void this.hydrateFromQuery();
  };

  /**
   * `push` — new history entry (browser Back returns to previous folder / URL).
   * `replace` — same entry (view switch, closing preview, syncing without stacking).
   */
  private syncRouterUrl = (mode: "push" | "replace" = "replace") => {
    if (typeof window === "undefined") return;
    const { router, files } = this.props;
    const { crumbs, previewItemIdForUrl } = this.state;
    const q = buildDashboardQuery(files.viewMode, crumbs, previewItemIdForUrl ?? undefined);
    const next = new URLSearchParams(q).toString();
    const cur = window.location.search.startsWith("?") ? window.location.search.slice(1) : "";
    if (next === cur) return;
    // Keep in sync with hydrate dedup so Back/Forward still run hydrate after folder navigation.
    this.lastHydratedSerialized = serializeUrlStateFromQuery(q);
    this.ignoreNextRouteChange = true;
    const nav = mode === "push" ? router.push : router.replace;
    void nav({ pathname: router.pathname, query: q }, undefined, { shallow: true });
  };

  private async hydrateFromQuery() {
    const { router, auth, store } = this.props;
    if (!auth.accessToken || !router.isReady) return;

    const q = router.query;
    const fromUrl = readDashboardQueryKeys(router);
    const viewParam = fromUrl.view ?? pickQueryString(q.view);
    const pathParam = fromUrl.path ?? pickQueryString(q.path);
    const itemParam = fromUrl.item ?? pickQueryString(q.item);
    const serialized = JSON.stringify({ viewParam, pathParam, itemParam });
    // Dedup must run before ++hydrateSeq: otherwise a second call with the same URL
    // returns early while seq was already bumped, and the first in-flight request aborts without UI.
    if (serialized === this.lastHydratedSerialized) return;
    const my = ++this.hydrateSeq;
    this.lastHydratedSerialized = serialized;

    const token = auth.accessToken;
    const opts = { userId: auth.user?.id, userEmail: auth.user?.email };

    try {
      this.setState({ linkError: null });
      if (itemParam) {
        const { item, pathFromRoot } = await api.getItemContext(token, itemParam, opts);
        if (my !== this.hydrateSeq) return;
        const isOwner = item.owner_id === auth.user?.id;
        const resolvedView: FilesViewMode = isOwner ? "mine" : "shared";
        const rootLabel = isOwner ? "My files" : item.is_public ? "Public" : "Shared with me";
        const crumbs: Crumb[] = [{ id: null, name: rootLabel }, ...pathFromRoot.map((f) => ({ id: f.id, name: f.name }))];

        if (item.item_type === "file") {
          const parentId = item.parent_id as string | null;
          void store.setViewMode(resolvedView, parentId);
          this.setState({ crumbs, previewItemIdForUrl: item.id }, () => {
            void this.openPreview(item as Item);
          });
        } else {
          void store.setViewMode(resolvedView, item.id);
          this.setState({
            crumbs,
            previewItemIdForUrl: null,
            previewUrl: null,
            previewName: null,
          });
        }
        return;
      }

      if (pathParam) {
        const ids = pathParam.split(",").map((s) => s.trim()).filter(Boolean);
        if (ids.length) {
          const lastId = ids[ids.length - 1];
          const { item, pathFromRoot } = await api.getItemContext(token, lastId, opts);
          if (my !== this.hydrateSeq) return;
          if (item.item_type !== "folder") {
            const viewMode: FilesViewMode = viewParam === "shared" ? "shared" : "mine";
            void store.setViewMode(viewMode);
            this.setState({
              crumbs: [{ id: null, name: viewMode === "shared" ? "Shared with me" : "My files" }],
              previewItemIdForUrl: null,
              previewUrl: null,
              previewName: null,
            });
            return;
          }
          const isOwnerPath = item.owner_id === auth.user?.id;
          const resolvedView: FilesViewMode = isOwnerPath ? "mine" : "shared";
          const rootLabel = isOwnerPath ? "My files" : item.is_public ? "Public" : "Shared with me";
          const crumbs: Crumb[] = [{ id: null, name: rootLabel }, ...pathFromRoot.map((f) => ({ id: f.id, name: f.name }))];
          void store.setViewMode(resolvedView, item.id);
          this.setState({
            crumbs,
            previewItemIdForUrl: null,
            previewUrl: null,
            previewName: null,
          });
          return;
        }
      }

      const viewMode: FilesViewMode = viewParam === "shared" ? "shared" : "mine";
      const rootLabel = viewMode === "shared" ? "Shared with me" : "My files";
      void store.setViewMode(viewMode);
      this.setState({
        crumbs: [{ id: null, name: rootLabel }],
        previewItemIdForUrl: null,
        previewUrl: null,
        previewName: null,
      });
    } catch {
      if (my !== this.hydrateSeq) return;
      this.lastHydratedSerialized = "";
      void store.setViewMode("mine");
      this.setState({
        crumbs: [{ id: null, name: "My files" }],
        previewItemIdForUrl: null,
        previewUrl: null,
        previewName: null,
        linkError:
          "This link could not be opened. The item may be private (only the owner and invited people), or it no longer exists.",
      });
    }
  }

  /** Anonymous: public items only (same deep-link query as signed-in). */
  private async hydrateGuestFromQuery() {
    const { router, auth } = this.props;
    if (auth.accessToken) return;

    const q = router.query;
    const fromUrl = readDashboardQueryKeys(router);
    const viewParam = fromUrl.view ?? pickQueryString(q.view);
    const pathParam = fromUrl.path ?? pickQueryString(q.path);
    const itemParam = fromUrl.item ?? pickQueryString(q.item);
    const serialized = JSON.stringify({ viewParam, pathParam, itemParam });
    if (serialized === this.lastHydratedSerialized) return;
    const my = ++this.hydrateSeq;
    this.lastHydratedSerialized = serialized;

    this.setState((s) => ({
      linkError: null,
      guestBrowse: { ...s.guestBrowse, loading: true, error: null },
    }));

    try {
      if (itemParam) {
        const { item, pathFromRoot } = await api.getPublicItemContext(itemParam);
        if (my !== this.hydrateSeq) return;
        const rootLabel = "Public";
        const crumbs: Crumb[] = [{ id: null, name: rootLabel }, ...pathFromRoot.map((f) => ({ id: f.id, name: f.name }))];

        if (item.item_type === "file") {
          const parentId = item.parent_id as string | null;
          const children = parentId
            ? (await api.listPublicChildren(parentId)).items
            : ([item] as Item[]);
          if (my !== this.hydrateSeq) return;
          this.setState(
            {
              crumbs,
              guestBrowse: { ready: true, items: children, loading: false, error: null },
              previewItemIdForUrl: item.id,
            },
            () => void this.openPreview(item as Item),
          );
          return;
        }

        const children = (await api.listPublicChildren(item.id)).items;
        if (my !== this.hydrateSeq) return;
        this.setState({
          crumbs,
          guestBrowse: { ready: true, items: children, loading: false, error: null },
          previewItemIdForUrl: null,
          previewUrl: null,
          previewName: null,
        });
        return;
      }

      if (pathParam) {
        const ids = pathParam.split(",").map((s) => s.trim()).filter(Boolean);
        if (ids.length) {
          const lastId = ids[ids.length - 1];
          const { item, pathFromRoot } = await api.getPublicItemContext(lastId);
          if (my !== this.hydrateSeq) return;
          if (item.item_type !== "folder") {
            const rootLabel = "Public";
            const crumbs: Crumb[] = [{ id: null, name: rootLabel }, ...pathFromRoot.map((f) => ({ id: f.id, name: f.name }))];
            const parentId = item.parent_id as string | null;
            const children = parentId
              ? (await api.listPublicChildren(parentId)).items
              : ([item] as Item[]);
            if (my !== this.hydrateSeq) return;
            this.setState(
              {
                crumbs,
                guestBrowse: { ready: true, items: children, loading: false, error: null },
                previewItemIdForUrl: item.id,
              },
              () => void this.openPreview(item as Item),
            );
            return;
          }
          const children = (await api.listPublicChildren(item.id)).items;
          if (my !== this.hydrateSeq) return;
          const rootLabel = "Public";
          const crumbs: Crumb[] = [{ id: null, name: rootLabel }, ...pathFromRoot.map((f) => ({ id: f.id, name: f.name }))];
          this.setState({
            crumbs,
            guestBrowse: { ready: true, items: children, loading: false, error: null },
            previewItemIdForUrl: null,
            previewUrl: null,
            previewName: null,
          });
          return;
        }
      }

      const rootLabel = viewParam === "shared" ? "Shared with me" : "My files";
      this.setState({
        crumbs: [{ id: null, name: rootLabel }],
        guestBrowse: { ready: true, items: [], loading: false, error: null },
        previewItemIdForUrl: null,
        previewUrl: null,
        previewName: null,
      });
    } catch {
      if (my !== this.hydrateSeq) return;
      this.lastHydratedSerialized = "";
      this.setState({
        crumbs: [{ id: null, name: "My files" }],
        guestBrowse: { ready: true, items: [], loading: false, error: null },
        previewItemIdForUrl: null,
        previewUrl: null,
        previewName: null,
        linkError:
          "This link could not be opened anonymously. Sign in to access private items, or ensure the item is public.",
      });
    }
  }

  private logout = () => {
    this.props.store.logout();
    this.setState({
      crumbs: [{ id: null, name: "My files" }],
      previewItemIdForUrl: null,
      previewUrl: null,
      previewName: null,
      linkError: null,
      guestBrowse: { ready: false, items: [], loading: false, error: null },
    });
    this.lastHydratedSerialized = "";
    if (typeof window !== "undefined" && this.props.router.isReady) {
      void this.hydrateGuestFromQuery();
    }
  };

  private setViewMode = (mode: FilesViewMode) => {
    void this.props.store.setViewMode(mode);
    this.setState(
      {
        crumbs: [{ id: null, name: mode === "shared" ? "Shared with me" : "My files" }],
        previewItemIdForUrl: null,
        previewUrl: null,
        previewName: null,
        linkError: null,
      },
      () => this.syncRouterUrl("replace"),
    );
  };

  private navigateFolder = (item: Item) => {
    if (item.item_type !== "folder") return;
    if (!this.props.auth.accessToken) {
      const nextCrumbs = [...this.state.crumbs, { id: item.id, name: item.name }];
      const q = buildDashboardQuery("mine", nextCrumbs);
      this.lastHydratedSerialized = "";
      void this.props.router.push({ pathname: "/", query: q }, undefined, { shallow: true });
      return;
    }
    this.setState(
      (s) => ({
        crumbs: [...s.crumbs, { id: item.id, name: item.name }],
        previewItemIdForUrl: null,
        previewUrl: null,
        previewName: null,
        linkError: null,
      }),
      () => {
        void this.props.store.loadFiles({ parentId: item.id });
        this.syncRouterUrl("push");
      },
    );
  };

  private navigateCrumb = (index: number) => {
    if (!this.props.auth.accessToken) {
      const next = this.state.crumbs.slice(0, index + 1);
      const q = buildDashboardQuery("mine", next);
      this.lastHydratedSerialized = "";
      void this.props.router.push({ pathname: "/", query: q }, undefined, { shallow: true });
      return;
    }
    const next = this.state.crumbs.slice(0, index + 1);
    const target = next[next.length - 1];
    this.setState(
      {
        crumbs: next,
        previewItemIdForUrl: null,
        previewUrl: null,
        previewName: null,
        linkError: null,
      },
      () => {
        void this.props.store.loadFiles({ parentId: target.id });
        this.syncRouterUrl("push");
      },
    );
  };

  private openNewFolderModal = () => {
    this.setState({ newFolderOpen: true, newFolderName: "" });
  };

  private submitNewFolder = () => {
    const name = this.state.newFolderName.trim();
    if (!name) return;
    void this.props.store.createFolder(name, false);
    this.setState({ newFolderOpen: false, newFolderName: "" });
  };

  private triggerUpload = () => {
    this.fileInputRef.current?.click();
  };

  private onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    const maxBytes = getMaxUploadBytes();
    if (f.size > maxBytes) {
      this.props.store.setFilesError(`File is too large. Maximum size is ${getMaxUploadMbLabel()} MB.`);
      return;
    }
    const clientId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
    void this.props.store.uploadFile(f, { clientId, isPublic: false });
  };

  private openDeleteModal = (item: Item) => {
    this.setState({ deleteTarget: item });
  };

  private confirmDelete = () => {
    const { deleteTarget } = this.state;
    if (!deleteTarget) return;
    this.setState({ deletingId: deleteTarget.id });
    void this.props.store.deleteItem(deleteTarget.id);
  };

  private openRenameModal = (item: Item) => {
    this.setState({ renameTarget: item, renameValue: item.name });
  };

  private submitRename = () => {
    const { renameTarget, renameValue } = this.state;
    const name = renameValue.trim();
    if (!renameTarget || !name) return;
    void this.props.store.renameItem(renameTarget.id, name);
    this.setState({ renameTarget: null, renameValue: "" });
  };

  private cloneItem = (id: string) => {
    this.setState({ cloningId: id });
    void this.props.store.cloneItem(id);
  };

  private togglePublic = (id: string, isPublic: boolean) => {
    this.setState({ togglingPublicId: id });
    void this.props.store.togglePublic(id, !isPublic);
  };

  private onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    void this.props.store.search(e.target.value);
  };

  private refreshList = () => {
    if (!this.props.auth.accessToken) {
      const { crumbs } = this.state;
      const last = crumbs[crumbs.length - 1];
      const parentId = crumbs.length > 1 && last?.id ? last.id : null;
      if (!parentId) {
        this.setState((s) => ({ guestBrowse: { ...s.guestBrowse, items: [] } }));
        return;
      }
      void (async () => {
        this.setState((s) => ({ guestBrowse: { ...s.guestBrowse, loading: true } }));
        try {
          const { items } = await api.listPublicChildren(parentId);
          this.setState({ guestBrowse: { ready: true, items, loading: false, error: null } });
        } catch {
          this.setState((s) => ({ guestBrowse: { ...s.guestBrowse, loading: false } }));
        }
      })();
      return;
    }
    void this.props.store.loadFiles({});
  };

  private openPreview = async (item: Item) => {
    if (item.item_type !== "file") return;
    if (!this.props.auth.accessToken) {
      try {
        const blob = await api.fetchPublicItemFileBlob(item.id);
        const mime = (item.mime_type || "").toLowerCase();
        if (mime.startsWith("image/")) {
          const previewUrl = URL.createObjectURL(blob);
          this.setState({ previewUrl, previewName: item.name, previewItemIdForUrl: item.id }, () =>
            this.syncRouterUrl("push"),
          );
        } else if (typeof window !== "undefined") {
          const blobUrl = URL.createObjectURL(blob);
          window.open(blobUrl, "_blank", "noopener,noreferrer");
          window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
          this.setState({ previewItemIdForUrl: item.id }, () => this.syncRouterUrl("push"));
        }
      } catch {
        this.setState({ previewUrl: null, previewName: null, previewItemIdForUrl: null }, () =>
          this.syncRouterUrl("replace"),
        );
      }
      return;
    }
    const token = this.props.auth.accessToken;
    try {
      const blob = await api.fetchItemFileBlob(token, item.id, {
        userId: this.props.auth.user?.id,
        userEmail: this.props.auth.user?.email,
      });
      const mime = (item.mime_type || "").toLowerCase();
      if (mime.startsWith("image/")) {
        const previewUrl = URL.createObjectURL(blob);
        this.setState({ previewUrl, previewName: item.name, previewItemIdForUrl: item.id }, () =>
          this.syncRouterUrl("push"),
        );
      } else if (typeof window !== "undefined") {
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, "_blank", "noopener,noreferrer");
        window.setTimeout(() => URL.revokeObjectURL(blobUrl), 120_000);
        this.setState({ previewItemIdForUrl: item.id }, () => this.syncRouterUrl("push"));
      }
    } catch {
      this.setState({ previewUrl: null, previewName: null, previewItemIdForUrl: null }, () => this.syncRouterUrl("replace"));
    }
  };

  private closePreview = () => {
    this.setState({ previewUrl: null, previewName: null, previewItemIdForUrl: null }, () => this.syncRouterUrl("replace"));
  };

  private downloadFile = async (item: Item) => {
    if (item.item_type !== "file") return;
    if (!this.props.auth.accessToken) {
      try {
        const blob = await api.fetchPublicItemFileBlob(item.id);
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = item.name;
        a.rel = "noopener noreferrer";
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(blobUrl);
      } catch {
        /* ignore */
      }
      return;
    }
    const token = this.props.auth.accessToken;
    try {
      const blob = await api.fetchItemFileBlob(token, item.id, {
        userId: this.props.auth.user?.id,
        userEmail: this.props.auth.user?.email,
      });
      // Blob URL + <a download> keeps filename; no Supabase signed URL in the client.
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = item.name;
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      /* ignore */
    }
  };

  private openShare = (item: Item) => {
    this.setState(
      {
        shareFor: item,
        shareEmail: "",
        sharePermission: "read",
        shareResult: null,
        shareRecipients: [],
        shareRecipientsLoading: true,
        removingShareId: null,
      },
      () => void this.loadShareRecipients(item.id),
    );
  };

  private loadShareRecipients = async (itemId: string) => {
    const token = this.props.auth.accessToken;
    if (!token) return;
    try {
      const { shares } = await api.listItemShares(token, itemId, {
        userId: this.props.auth.user?.id,
        userEmail: this.props.auth.user?.email,
      });
      const mapped: ItemShareRecipient[] = shares.map((r) => ({
        id: r.id,
        email: r.email,
        permission: (["read", "write", "admin"].includes(r.permission) ? r.permission : "read") as ItemShareRecipient["permission"],
        created_at: r.created_at,
      }));
      this.setState({ shareRecipients: mapped, shareRecipientsLoading: false });
    } catch {
      this.setState({ shareRecipients: [], shareRecipientsLoading: false });
    }
  };

  private removeShareRecipient = async (shareId: string) => {
    const { shareFor } = this.state;
    const token = this.props.auth.accessToken;
    if (!shareFor || !token) return;
    this.setState({ removingShareId: shareId });
    try {
      await api.revokeItemShare(token, shareFor.id, shareId, {
        userId: this.props.auth.user?.id,
        userEmail: this.props.auth.user?.email,
      });
      this.setState((s) => ({
        shareRecipients: s.shareRecipients.filter((x) => x.id !== shareId),
        removingShareId: null,
        shareResult: "Access removed.",
      }));
    } catch (err: unknown) {
      this.setState({
        removingShareId: null,
        shareResult: String((err as Error).message ?? "Could not remove access"),
      });
    }
  };

  private copyShareItemLink = () => {
    const { shareFor } = this.state;
    if (!shareFor || typeof window === "undefined") return;
    const q = buildDashboardQuery(this.props.files.viewMode, this.state.crumbs, shareFor.id);
    const u = `${window.location.origin}${window.location.pathname}?${new URLSearchParams(q).toString()}`;
    void navigator.clipboard.writeText(u);
  };

  private copyItemUrl = (item: Item) => {
    if (typeof window === "undefined") return;
    const q = buildDashboardQuery(this.props.files.viewMode, this.state.crumbs, item.id);
    const u = `${window.location.origin}${window.location.pathname}?${new URLSearchParams(q).toString()}`;
    void navigator.clipboard.writeText(u);
    this.setState({ copiedItemId: item.id });
    window.setTimeout(() => this.setState({ copiedItemId: null }), 2000);
  };

  private closeShare = () => {
    this.setState({
      shareFor: null,
      shareResult: null,
      shareRecipients: [],
      shareRecipientsLoading: false,
      removingShareId: null,
    });
  };

  private submitShare = async (e: React.FormEvent) => {
    e.preventDefault();
    const { shareFor, shareEmail, sharePermission } = this.state;
    const token = this.props.auth.accessToken;
    if (!shareFor || !token) return;
    const email = shareEmail.trim();
    if (!email) {
      this.setState({ shareResult: "Enter an email address." });
      return;
    }
    try {
      await api.shareItem(token, shareFor.id, {
        email,
        permission: sharePermission,
      });
      this.setState({ shareResult: "Invitation saved.", shareEmail: "" });
      await this.loadShareRecipients(shareFor.id);
    } catch (err: unknown) {
      this.setState({ shareResult: String((err as Error).message ?? "Failed") });
    }
  };

  private onDragStart = (id: string) => {
    this.setState({ dragId: id });
  };

  private onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  private onDrop = (targetId: string) => {
    const { dragId } = this.state;
    this.setState({ dragId: null });
    const itemsSorted = [...this.props.files.items].sort((a, b) => a.sort_order - b.sort_order);
    const payload = buildReorderPayload(itemsSorted, dragId ?? "", targetId);
    if (!payload) return;
    void this.props.store.reorderItems(payload);
  };

  render() {
    const { auth, files } = this.props;
    const sharedView = files.viewMode === "shared" || !auth.accessToken;
    const {
      crumbs,
      shareFor,
      previewUrl,
      previewName,
      newFolderOpen,
      newFolderName,
      renameTarget,
      renameValue,
      deleteTarget,
      deletingId,
      copiedItemId,
      linkError,
      guestBrowse,
    } = this.state;

    if (!auth.accessToken && !guestBrowse.ready) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      );
    }

    const signInHref =
      typeof window !== "undefined"
        ? `/sign-in?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`
        : "/sign-in";

    const list = auth.accessToken
      ? sortedVisibleList(files)
      : [...guestBrowse.items].sort((a, b) => a.sort_order - b.sort_order);
    const pendingUploads =
      auth.accessToken && files.viewMode === "mine" && !files.searchQuery.trim() ? files.pendingUploads : [];

    const toolbarLoading = auth.accessToken ? files.loading : guestBrowse.loading;

    return (
      <>
        <Head>
          <title>File manager</title>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <div className="min-h-screen bg-background p-6">
          <DashboardHeader
            email={auth.user?.email}
            onLogout={this.logout}
            signInHref={auth.accessToken ? undefined : signInHref}
          />

          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <DashboardToolbar
              viewMode={files.viewMode}
              onViewModeChange={this.setViewMode}
              hideViewSwitcher={!auth.accessToken}
              readOnly={sharedView}
              crumbs={crumbs}
              onNavigateCrumb={this.navigateCrumb}
              onSearchChange={this.onSearchChange}
              onNewFolder={this.openNewFolderModal}
              onRefresh={this.refreshList}
              loading={toolbarLoading}
              onUploadClick={this.triggerUpload}
              fileInputRef={this.fileInputRef}
              onFileChange={this.onFileChange}
            />

            <Separator className="mb-4" />

            {auth.accessToken && files.error ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{files.error}</AlertDescription>
              </Alert>
            ) : null}

            {linkError ? (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{linkError}</AlertDescription>
              </Alert>
            ) : null}

            <FilesTable
              list={list}
              pendingUploads={pendingUploads}
              currentUserId={auth.user?.id ?? null}
              allowReorder={!sharedView}
              togglingPublicId={this.state.togglingPublicId}
              cloningId={this.state.cloningId}
              copiedItemId={copiedItemId}
              onNavigateFolder={this.navigateFolder}
              onOpenPreview={this.openPreview}
              onShare={this.openShare}
              onTogglePublic={this.togglePublic}
              onRenameClick={this.openRenameModal}
              onClone={this.cloneItem}
              onDeleteClick={this.openDeleteModal}
              onDownload={this.downloadFile}
              onDragStart={this.onDragStart}
              onDragOver={this.onDragOver}
              onDrop={this.onDrop}
              onCopyUrl={this.copyItemUrl}
            />
          </div>

          <TextPromptDialog
            open={newFolderOpen}
            onOpenChange={(open) => !open && this.setState({ newFolderOpen: false, newFolderName: "" })}
            title="New folder"
            description="Create a folder in the current location."
            label="Folder name"
            value={newFolderName}
            onValueChange={(v) => this.setState({ newFolderName: v })}
            onSubmit={this.submitNewFolder}
            submitLabel="Create"
            placeholder="My folder"
            inputId="new-folder-name"
          />

          <TextPromptDialog
            open={!!renameTarget}
            onOpenChange={(open) => !open && this.setState({ renameTarget: null, renameValue: "" })}
            title="Rename"
            description={renameTarget ? `Rename “${renameTarget.name}”.` : undefined}
            label="New name"
            value={renameValue}
            onValueChange={(v) => this.setState({ renameValue: v })}
            onSubmit={this.submitRename}
            submitLabel="Save"
            placeholder="Name"
            inputId="rename-item-name"
          />

          <ConfirmDeleteDialog
            open={!!deleteTarget}
            onOpenChange={(open) => !open && !deletingId && this.setState({ deleteTarget: null })}
            itemName={deleteTarget?.name ?? ""}
            onConfirm={this.confirmDelete}
            deleting={!!deletingId}
          />

          <PreviewDialog
            open={!!previewUrl}
            previewUrl={previewUrl}
            previewName={previewName}
            onOpenChange={(open) => !open && this.closePreview()}
          />

          <ShareDialog
            open={!!shareFor}
            item={shareFor}
            shareEmail={this.state.shareEmail}
            sharePermission={this.state.sharePermission}
            shareResult={this.state.shareResult}
            shareRecipients={this.state.shareRecipients}
            shareRecipientsLoading={this.state.shareRecipientsLoading}
            removingShareId={this.state.removingShareId}
            onOpenChange={(open) => !open && this.closeShare()}
            onShareEmailChange={(v) => this.setState({ shareEmail: v })}
            onPermissionChange={(v) => this.setState({ sharePermission: v })}
            onSubmit={this.submitShare}
            onCancel={this.closeShare}
            onCopyItemLink={this.copyShareItemLink}
            onRemoveShare={this.removeShareRecipient}
          />
        </div>
      </>
    );
  }
}

function DashboardPageWithStore(props: { router: NextRouter }) {
  const { auth, files, store } = useAppStore();
  return <DashboardPageInner {...props} auth={auth} files={files} store={store} />;
}

export default withRouter(DashboardPageWithStore);
