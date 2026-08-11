import { registerEvent } from "../register-event";
import { db, levelKeys, steamWishlistSublevel } from "@main/level";
import type { SteamWishlistState, UserPreferences } from "@types";

// Rebuild the wishlist state from what's stored: profile fields live in user
// preferences, the (potentially large) item list lives in its own sublevel.
const getSteamWishlist = async (): Promise<SteamWishlistState> => {
  const userPreferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const steamId = userPreferences?.steamWishlistSteamId;

  if (!steamId) {
    return { connected: false, profile: null, items: [], syncedAt: null };
  }

  const items =
    (await steamWishlistSublevel.get(steamId).catch(() => null)) ?? [];

  return {
    connected: true,
    profile: {
      steamId64: steamId,
      personaName: userPreferences?.steamWishlistPersonaName ?? steamId,
      avatarUrl: userPreferences?.steamWishlistAvatarUrl ?? "",
    },
    items,
    syncedAt: userPreferences?.steamWishlistSyncedAt ?? null,
  };
};

registerEvent("getSteamWishlist", getSteamWishlist);
