import { registerEvent } from "../register-event";
import { HydraApi } from "@main/services";
import {
  gamesSublevel,
  gamesShopAssetsSublevel,
  gamesArtworkSelectionSublevel,
  levelKeys,
} from "@main/level";
import type { GameShop } from "@types";

export interface ClearLibraryTarget {
  shop: GameShop;
  objectId: string;
}

const hardDelete = async (gameKey: string, remoteId?: string | null) => {
  if (remoteId) {
    HydraApi.delete(`/profile/games/${remoteId}`).catch(() => {});
  }
  await gamesSublevel.del(gameKey).catch(() => {});
  await gamesShopAssetsSublevel.del(gameKey).catch(() => {});
  await gamesArtworkSelectionSublevel.del(gameKey).catch(() => {});
};

/**
 * Clear the library as a full reset (fork feature): hard-delete game records so
 * a later Steam import can bring games back (unlike removing a single game,
 * which soft-deletes with isDeleted and blocks re-import). Downloaded files on
 * disk are NOT touched — only library entries and their metadata.
 *
 * With `targets`, only those games are removed (used to clear just what the
 * current library filter shows, e.g. only Classics); without it, the whole
 * library is cleared.
 */
const clearLibrary = async (
  _event: Electron.IpcMainInvokeEvent,
  targets?: ClearLibraryTarget[]
) => {
  if (targets && targets.length > 0) {
    for (const target of targets) {
      const gameKey = levelKeys.game(target.shop, target.objectId);
      const game = await gamesSublevel.get(gameKey).catch(() => null);
      await hardDelete(gameKey, game?.remoteId);
    }
    return;
  }

  const entries = await gamesSublevel.iterator().all();
  for (const [gameKey, game] of entries) {
    await hardDelete(gameKey, game.remoteId);
  }
};

registerEvent("clearLibrary", clearLibrary);
