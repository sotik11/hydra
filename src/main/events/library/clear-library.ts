import { registerEvent } from "../register-event";
import { HydraApi } from "@main/services";
import {
  gamesSublevel,
  gamesShopAssetsSublevel,
  gamesArtworkSelectionSublevel,
} from "@main/level";

/**
 * Clear the whole library as a full reset (fork feature): hard-delete every game
 * record so a later Steam import can bring games back (unlike removing a single
 * game, which soft-deletes with isDeleted and blocks re-import). Downloaded game
 * files on disk are NOT touched — only the library entries and their metadata.
 * Remote profile entries are removed too, mirroring single-game removal.
 */
const clearLibrary = async () => {
  const entries = await gamesSublevel.iterator().all();

  for (const [gameKey, game] of entries) {
    if (game.remoteId) {
      HydraApi.delete(`/profile/games/${game.remoteId}`).catch(() => {});
    }
    await gamesSublevel.del(gameKey).catch(() => {});
    await gamesShopAssetsSublevel.del(gameKey).catch(() => {});
    await gamesArtworkSelectionSublevel.del(gameKey).catch(() => {});
  }
};

registerEvent("clearLibrary", clearLibrary);
