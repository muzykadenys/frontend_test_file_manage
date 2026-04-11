import { apiClient, shouldLogoutOn401 } from "@/lib/apiClient";
import { appStore } from "./appStore";

apiClient.interceptors.response.use(
  (res) => res,
  (err) => {
    if (shouldLogoutOn401(err)) {
      appStore.logout();
    }
    return Promise.reject(err);
  },
);

export { appStore } from "./appStore";
export type { AppStoreApi, RootState } from "./appStore";
export { StoreProvider, useAppStore } from "./StoreContext";
