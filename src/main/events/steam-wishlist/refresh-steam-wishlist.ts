import { registerEvent } from "../register-event";
import { syncSteamWishlistFromSession } from "@main/services/steam-wishlist";
import type { SteamWishlistSummary } from "@types";

// Re-pull the wishlist through upstream's Steam session and reconcile the
// working store. Never throws: with a stale/missing session the wishlist is
// left as it is and the summary comes back with status "unavailable".
const refreshSteamWishlist = (): Promise<SteamWishlistSummary> =>
  syncSteamWishlistFromSession();

registerEvent("refreshSteamWishlist", refreshSteamWishlist);
