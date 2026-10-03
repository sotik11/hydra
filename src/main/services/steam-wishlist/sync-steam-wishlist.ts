import { steamWishlistSublevel } from "@main/level";
import { logger } from "@main/services/logger";
import type { SteamWishlistSummary } from "@types";

import { fetchSteamWishlistWithSession } from "./steam-wishlist";
import {
  removeSteamSourcedWishlistGames,
  syncSteamWishlistToStore,
} from "./wishlist-games";
import { checkWishlistReminders } from "./wishlist-reminders";

// Single cache record: the raw Steam wishlist of the connected account.
export const STEAM_WISHLIST_CACHE_KEY = "current";

let inFlight: Promise<SteamWishlistSummary> | null = null;

export async function getSteamWishlistSummary(): Promise<SteamWishlistSummary> {
  const cache = await steamWishlistSublevel
    .get(STEAM_WISHLIST_CACHE_KEY)
    .catch(() => null);

  return {
    status: "ok",
    count: cache?.items.length ?? null,
    syncedAt: cache?.syncedAt ?? null,
  };
}

const runSync = async (): Promise<SteamWishlistSummary> => {
  try {
    const { steamId64, items } = await fetchSteamWishlistWithSession();
    const syncedAt = Date.now();

    await steamWishlistSublevel.put(STEAM_WISHLIST_CACHE_KEY, {
      steamId64,
      items,
      syncedAt,
    });
    await syncSteamWishlistToStore(items);

    // Record reminder baselines for newly synced games (fire-and-forget).
    void checkWishlistReminders();

    logger.info("[steam-wishlist] synced from Steam session", {
      items: items.length,
    });

    return { status: "ok", count: items.length, syncedAt };
  } catch (err) {
    // A stale or missing Steam session is the normal failure here: keep the
    // wishlist as it is and let the next successful Steam sync refresh it.
    logger.info(
      "[steam-wishlist] Steam session unavailable, wishlist left untouched",
      err instanceof Error ? err.message : err
    );

    const summary = await getSteamWishlistSummary();
    return { ...summary, status: "unavailable" };
  }
};

/**
 * Refresh the wishlist from the upstream Steam session and reconcile the
 * working store (adds new Steam games, drops the ones removed in Steam, never
 * touches manual entries). Never throws.
 */
export function syncSteamWishlistFromSession(): Promise<SteamWishlistSummary> {
  inFlight ??= runSync().finally(() => {
    inFlight = null;
  });

  return inFlight;
}

/**
 * Steam was disconnected: forget the cached Steam wishlist and remove the games
 * it brought in. Manually added games stay.
 */
export async function clearSteamWishlist(): Promise<void> {
  await steamWishlistSublevel.clear().catch(() => {});
  await removeSteamSourcedWishlistGames();
}
