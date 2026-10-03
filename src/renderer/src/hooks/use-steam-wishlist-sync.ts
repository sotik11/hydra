import { useEffect } from "react";

// Fork: the Steam wishlist rides on upstream's Steam session, so it is refreshed
// right after each successful Steam sync (startup sync included). A failed or
// cancelled sync leaves the wishlist untouched.
export function useSteamWishlistSync() {
  useEffect(() => {
    const unsubscribe = window.electron.onSteamSyncFinished((payload) => {
      if (!payload.ok || !payload.status.connected) return;
      window.electron.refreshSteamWishlist().catch(() => {});
    });

    return unsubscribe;
  }, []);
}
