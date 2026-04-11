import React, { createContext, useContext, useSyncExternalStore } from "react";
import { appStore, type AppStoreApi, type RootState } from "./appStore";

const StoreCtx = createContext<AppStoreApi | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  React.useEffect(() => {
    appStore.restoreSession();
  }, []);
  return <StoreCtx.Provider value={appStore}>{children}</StoreCtx.Provider>;
}

export function useAppStore(): {
  auth: RootState["auth"];
  files: RootState["files"];
  store: AppStoreApi;
} {
  const store = useContext(StoreCtx);
  if (!store) {
    throw new Error("StoreProvider is required");
  }
  const snap = useSyncExternalStore(store.subscribe, store.getState, store.getState);
  return { auth: snap.auth, files: snap.files, store };
}
