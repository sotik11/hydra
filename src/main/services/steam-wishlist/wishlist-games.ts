import { wishlistGamesSublevel, wishlistDenylistSublevel } from "@main/level";
import type { SteamWishlistItem, WishlistGame } from "@types";

export async function getWishlistGames(): Promise<WishlistGame[]> {
  return wishlistGamesSublevel.values().all();
}

/**
 * Clear the whole wishlist. Behaves like removing every game by hand: each
 * appId goes on the denylist so the Steam auto-import won't bring them back;
 * manual re-adds are still possible.
 */
export async function clearWishlist(): Promise<void> {
  const games = await wishlistGamesSublevel.values().all();
  await Promise.all(
    games.map((g) => wishlistDenylistSublevel.put(g.appId, true))
  );
  await wishlistGamesSublevel.clear();
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

    await wishlistGamesSublevel.put(item.appId, {
      appId: item.appId,
      source: "steam",
      addedAt: item.dateAdded ? item.dateAdded * 1000 : Date.now(),
    });
  }
}
