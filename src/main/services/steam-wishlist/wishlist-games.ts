import {
  wishlistGamesSublevel,
  wishlistDenylistSublevel,
  gamesSublevel,
  levelKeys,
} from "@main/level";
import type {
  SteamWishlistItem,
  WishlistGame,
  WishlistGameMetaCache,
} from "@types";

// A game that already lives in the library (not soft-deleted) never belongs in
// the wishlist — you wishlist what you don't own yet.
async function isInLibrary(appId: string): Promise<boolean> {
  const entry = await gamesSublevel
    .get(levelKeys.game("steam", appId))
    .catch(() => null);
  return Boolean(entry && !entry.isDeleted);
}

export async function getWishlistGames(): Promise<WishlistGame[]> {
  return wishlistGamesSublevel.values().all();
}

/**
 * Cache resolved static metadata (title/cover/genres/year) onto an existing
 * wishlist record so search and title-sort are instant next time. No-ops if the
 * game isn't in the wishlist (e.g. removed while resolving). Repack sources are
 * never cached here — they're always fetched fresh.
 */
export async function updateWishlistGameMeta(
  appId: string,
  meta: WishlistGameMetaCache
): Promise<void> {
  const existing = await wishlistGamesSublevel.get(appId).catch(() => null);
  if (!existing) return;

  await wishlistGamesSublevel.put(appId, {
    ...existing,
    ...meta,
    metaCachedAt: Date.now(),
  });
}

/**
 * Clear the whole wishlist as a full reset: wipe the store AND the denylist, so
 * the next Steam import brings every game back. This is different from removing
 * a single game by hand (the X on a card), which denylists that appId so it
 * won't auto-return.
 */
export async function clearWishlist(): Promise<void> {
  await wishlistGamesSublevel.clear();
  await wishlistDenylistSublevel.clear();
}

/**
 * Manually add a game to the wishlist (e.g. the ⭐ button in the catalogue).
 * Allowed even if the game was previously removed (denylisted): the denylist is
 * kept so the Steam auto-import still won't bring it back, but this manual
 * record makes it visible again.
 */
export async function addManualWishlistGame(appId: string): Promise<void> {
  const existing = await wishlistGamesSublevel.get(appId).catch(() => null);
  if (existing) return;

  await wishlistGamesSublevel.put(appId, {
    appId,
    source: "manual",
    addedAt: Date.now(),
  });
}

/**
 * Remove a game from the wishlist by hand. Denylists its appId so the Steam
 * auto-import won't re-add it on refresh/reconnect (survives disconnect).
 */
export async function removeWishlistGame(appId: string): Promise<void> {
  await wishlistGamesSublevel.del(appId).catch(() => {});
  await wishlistDenylistSublevel.put(appId, true);
}

/**
 * Reconcile the store with the raw Steam wishlist: add newly-wishlisted Steam
 * games (unless denied or already present) and drop steam-sourced games the
 * user removed in Steam. Manual games are never touched.
 */
export async function syncSteamWishlistToStore(
  items: SteamWishlistItem[]
): Promise<void> {
  const denied = new Set(
    await wishlistDenylistSublevel
      .keys()
      .all()
      .catch(() => [] as string[])
  );
  const currentIds = new Set(items.map((item) => item.appId));

  const existingEntries = await wishlistGamesSublevel.iterator().all();
  const existingIds = new Set(existingEntries.map(([appId]) => appId));

  for (const [appId, game] of existingEntries) {
    if (game.source === "steam" && !currentIds.has(appId)) {
      await wishlistGamesSublevel.del(appId).catch(() => {});
    }
  }

  for (const item of items) {
    if (denied.has(item.appId)) continue;
    if (existingIds.has(item.appId)) continue;
    if (await isInLibrary(item.appId)) continue;

    await wishlistGamesSublevel.put(item.appId, {
      appId: item.appId,
      source: "steam",
      addedAt: item.dateAdded ? item.dateAdded * 1000 : Date.now(),
    });
  }
}
