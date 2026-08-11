import { registerEvent } from "../register-event";
import { steamWishlistSublevel } from "@main/level";
import {
  resolveSteamProfile,
  fetchSteamWishlist,
  fetchOwnedGames,
  importOwnedGamesToLibrary,
  syncSteamWishlistToStore,
} from "@main/services/steam-wishlist";
import { logger } from "@main/services";
import type { SteamWishlistState } from "@types";

// Resolve any SteamID/profile input, pull the wishlist, and cache the items
// locally. With an API key, also resolve the profile reliably (API) and import
// the owned-games library into Hydra. The renderer persists the profile fields,
// the API key and the library count to user preferences.
const connectSteamWishlist = async (
  _event: Electron.IpcMainInvokeEvent,
  profileInput: string,
  apiKey?: string | null
): Promise<SteamWishlistState> => {
  const key = apiKey?.trim() || null;

  const profile = await resolveSteamProfile(profileInput, key);
  const items = await fetchSteamWishlist(profile.steamId64);

  await steamWishlistSublevel.put(profile.steamId64, items);
  await syncSteamWishlistToStore(items);

  let libraryCount: number | null = null;
  if (key) {
    try {
      const owned = await fetchOwnedGames(profile.steamId64, key);
      libraryCount = await importOwnedGamesToLibrary(owned);
    } catch (err) {
      // Library import is optional — a bad/missing key must not fail the
      // wishlist connect.
      logger.error("[steam-wishlist] owned games import failed", err);
    }
  }

  logger.info("[steam-wishlist] connected", {
    steamId: profile.steamId64,
    items: items.length,
    libraryCount,
  });

  return {
    connected: true,
    profile,
    items,
    syncedAt: Date.now(),
    hasApiKey: Boolean(key),
    libraryCount,
  };
};

registerEvent("connectSteamWishlist", connectSteamWishlist);
