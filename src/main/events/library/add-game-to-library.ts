import { registerEvent } from "../register-event";
import type { GameShop } from "@types";
import { createGame } from "@main/services/library-sync";
import {
  gamesShopAssetsSublevel,
  gamesShopCacheSublevel,
  gamesSublevel,
  levelKeys,
} from "@main/level";
import { clearFinishedDownload } from "@main/helpers";
import { AchievementWatcherManager } from "@main/services/achievements/achievement-watcher-manager";
import { updateNexusMatchForGame } from "@main/services/nexus-mods";

const lookupCachedPlatform = async (
  shop: GameShop,
  objectId: string
): Promise<string | null> => {
  const prefix = `${shop}:${objectId}:`;
  try {
    const entries = await gamesShopCacheSublevel.iterator().all();
    for (const [key, value] of entries) {
      if (
        typeof key === "string" &&
        key.startsWith(prefix) &&
        value?.platform
      ) {
        return value.platform;
      }
    }
  } catch {
    return null;
  }
  return null;
};

const addGameToLibrary = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  title: string,
  platform?: string | null,
  availableToInstall?: boolean
) => {
  const gameKey = levelKeys.game(shop, objectId);
  let game = await gamesSublevel.get(gameKey);

  const gameAssets = await gamesShopAssetsSublevel.get(gameKey);

  const resolvedPlatform =
    platform ??
    (shop === "launchbox" ? await lookupCachedPlatform(shop, objectId) : null);

  if (game) {
    await clearFinishedDownload(shop, objectId);

    game.isDeleted = false;
    game.addedToLibraryAt ??= new Date();
    if (resolvedPlatform && !game.platform) game.platform = resolvedPlatform;
    // Fork: mark "available to install" (carried from the wishlist) until the
    // game is actually installed; the executable path clears it below.
    if (availableToInstall) game.availableToInstall = true;
    if (game.executablePath) game.availableToInstall = false;

    await gamesSublevel.put(gameKey, game);
  } else {
    game = {
      title,
      iconUrl: gameAssets?.iconUrl ?? null,
      libraryHeroImageUrl: gameAssets?.libraryHeroImageUrl ?? null,
      logoImageUrl: gameAssets?.logoImageUrl ?? null,
      objectId,
      shop,
      remoteId: null,
      isDeleted: false,
      playTimeInMilliseconds: 0,
      lastTimePlayed: null,
      addedToLibraryAt: new Date(),
      platform: resolvedPlatform ?? null,
      availableToInstall: Boolean(availableToInstall),
    };

    await gamesSublevel.put(gameKey, game);
  }

  if (game) {
    await createGame(game).catch(() => {});

    AchievementWatcherManager.syncGameAchievementFiles(
      game.shop,
      game.objectId
    );

    // Keep the Nexus match map fresh for this game (no-op when Nexus isn't
    // connected / has no cached catalogue). Fire-and-forget.
    void updateNexusMatchForGame(game);
  }
};

registerEvent("addGameToLibrary", addGameToLibrary);
