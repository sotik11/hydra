import { createGame } from "@main/services/library-sync";
import { gamesShopAssetsSublevel, gamesSublevel, levelKeys } from "@main/level";
import { logger } from "@main/services";
import type { Game, SteamOwnedGame } from "@types";

/**
 * Add owned Steam games to the Hydra library as regular entries, skipping any
 * game already present (never touching the user's own records). These are
 * normal library entries — disconnecting the Steam wishlist does NOT remove
 * them. Local writes are awaited (fast) so the games appear immediately; the
 * cloud-sync (createGame) runs in the background so a large library doesn't
 * block the connect flow. Returns how many new games were added.
 */
export async function importOwnedGamesToLibrary(
  owned: SteamOwnedGame[]
): Promise<number> {
  const toSync: Game[] = [];

  for (const game of owned) {
    const gameKey = levelKeys.game("steam", game.appId);
    const existing = await gamesSublevel.get(gameKey).catch(() => null);
    if (existing && !existing.isDeleted) continue;

    const assets = await gamesShopAssetsSublevel.get(gameKey).catch(() => null);

    const entry: Game = {
      title: game.title,
      iconUrl: assets?.iconUrl ?? null,
      libraryHeroImageUrl: assets?.libraryHeroImageUrl ?? null,
      logoImageUrl: assets?.logoImageUrl ?? null,
      objectId: game.appId,
      shop: "steam",
      remoteId: null,
      isDeleted: false,
      playTimeInMilliseconds: 0,
      lastTimePlayed: null,
      addedToLibraryAt: new Date(),
      platform: null,
    };

    await gamesSublevel.put(gameKey, entry);
    toSync.push(entry);
  }

  if (toSync.length > 0) {
    void (async () => {
      for (const entry of toSync) {
        await createGame(entry).catch(() => {});
      }
      logger.info("[steam-wishlist] owned games cloud-synced", {
        count: toSync.length,
      });
    })();
  }

  return toSync.length;
}
