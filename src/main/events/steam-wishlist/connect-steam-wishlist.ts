import { registerEvent } from "../register-event";
import { steamWishlistSublevel } from "@main/level";
import {
  resolveSteamProfile,
  fetchSteamWishlist,
} from "@main/services/steam-wishlist";
import { logger } from "@main/services";
import type { SteamWishlistState } from "@types";

// Resolve any SteamID/profile input, pull the wishlist, and cache the items
// locally. The renderer persists the profile fields to user preferences.
const connectSteamWishlist = async (
  _event: Electron.IpcMainInvokeEvent,
  profileInput: string
): Promise<SteamWishlistState> => {
  const profile = await resolveSteamProfile(profileInput);
  const items = await fetchSteamWishlist(profile.steamId64);

  await steamWishlistSublevel.put(profile.steamId64, items);

  logger.info("[steam-wishlist] connected", {
    steamId: profile.steamId64,
    items: items.length,
  });

  return { connected: true, profile, items, syncedAt: Date.now() };
};

registerEvent("connectSteamWishlist", connectSteamWishlist);
