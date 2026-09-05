import { createGame } from "@main/services/library-sync";
import { gamesShopAssetsSublevel, gamesSublevel, levelKeys } from "@main/level";
import { logger } from "@main/services";
import type { Game, SteamOwnedGame } from "@types";
import { recordImportedAppIds } from "./restamp-library-import";

/**
 * Add owned Steam games to the Hydra library as regular entries. Behaviour per
 * owned game:
 *  - already present & not deleted → just add the Steam import badge (leave the
 *    rest of the record untouched);
 *  - soft-deleted (user removed it after a previous import) → SKIP, never
 *    resurrect it. The isDeleted record lives in gamesSublevel and survives
 *    disconnect, so it also blocks re-adding after reconnect — this is the
 *    implicit "removed from Steam import" list;
 *  - not present → create it.
 *
 * Local writes are awaited (fast); cloud-sync (createGame) runs in the
 * background so a large library doesn't block the connect flow. Returns how
 * many owned games are actually in the library now (excludes removed ones), so
 * the "library · N games" counter shrinks after the user prunes junk.
 */
export async function importOwnedGamesToLibrary(
  owned: SteamOwnedGame[]
): Promise<number> {
  const toSync: Game[] = [];
  let inLibrary = 0;

  for (const game of owned) {
    const gameKey = levelKeys.game("steam", game.appId);
    const existing = await gamesSublevel.get(gameKey).catch(() => null);

    if (existing?.isDeleted) {
      // User removed this game after a previous import — do NOT resurrect it.
      continue;
    }

    if (existing) {
      if (!existing.steamLibraryImport) {
        await gamesSublevel.put(gameKey, {
          ...existing,
          steamLibraryImport: true,
        });
      }
      inLibrary += 1;
      continue;
    }

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
      steamLibraryImport: true,
    };

    await gamesSublevel.put(gameKey, entry);
    toSync.push(entry);
    inLibrary += 1;
  }

  // Remember which appIds are ours in a durable sublevel so the flag can be
  // re-applied after cloud sync / relogin wipes it from the game records.
  await recordImportedAppIds(owned.map((game) => game.appId));

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

  return inLibrary;
}
