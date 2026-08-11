import { registerEvent } from "../register-event";
import { db, levelKeys, steamWishlistSublevel } from "@main/level";
import {
  resolveSteamProfile,
  fetchSteamWishlist,
  fetchOwnedGames,
  importOwnedGamesToLibrary,
  syncSteamWishlistToStore,
} from "@main/services/steam-wishlist";
import { logger } from "@main/services";
import type { SteamWishlistState, UserPreferences } from "@types";

// Re-pull the wishlist (and refresh persona/avatar) for the already-connected
// account. With a stored API key, also re-import the owned-games library
// (skipping games already present). The renderer persists the updated fields.
const refreshSteamWishlist = async (): Promise<SteamWishlistState> => {
  const userPreferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const steamId = userPreferences?.steamWishlistSteamId;

  if (!steamId) {
    throw new Error("steam-wishlist/not-connected");
  }

  const key = userPreferences?.steamWishlistApiKey || null;

  const profile = await resolveSteamProfile(steamId, key);
  const items = await fetchSteamWishlist(profile.steamId64);

  await steamWishlistSublevel.put(profile.steamId64, items);
  await syncSteamWishlistToStore(items);

  let libraryCount = userPreferences?.steamWishlistLibraryCount ?? null;
  if (key) {
    try {
      const owned = await fetchOwnedGames(profile.steamId64, key);
      libraryCount = await importOwnedGamesToLibrary(owned);
    } catch (err) {
      logger.error("[steam-wishlist] refresh owned games failed", err);
    }
  }

  return {
    connected: true,
    profile,
    items,
    syncedAt: Date.now(),
    hasApiKey: Boolean(key),
    libraryCount,
  };
};

registerEvent("refreshSteamWishlist", refreshSteamWishlist);
