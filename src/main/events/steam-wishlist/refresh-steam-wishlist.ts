import { registerEvent } from "../register-event";
import { db, levelKeys, steamWishlistSublevel } from "@main/level";
import {
  resolveSteamProfile,
  fetchSteamWishlist,
} from "@main/services/steam-wishlist";
import type { SteamWishlistState, UserPreferences } from "@types";

// Re-pull the wishlist (and refresh persona/avatar) for the already-connected
// account. The renderer persists the updated profile fields.
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

  const profile = await resolveSteamProfile(steamId);
  const items = await fetchSteamWishlist(profile.steamId64);

  await steamWishlistSublevel.put(profile.steamId64, items);

  return { connected: true, profile, items, syncedAt: Date.now() };
};

registerEvent("refreshSteamWishlist", refreshSteamWishlist);
