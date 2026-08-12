import {
  wishlistGamesSublevel,
  downloadSourcesSublevel,
  gamesSublevel,
  levelKeys,
} from "@main/level";
import { HydraApi } from "../hydra-api";
import { WindowManager } from "../window-manager";
import { logger } from "../logger";
import type { GameRepack, WishlistGame } from "@types";

const CONCURRENCY = 4;

export interface WishlistAvailablePayload {
  appId: string;
  title: string;
}

async function isInLibrary(appId: string): Promise<boolean> {
  const entry = await gamesSublevel
    .get(levelKeys.game("steam", appId))
    .catch(() => null);
  return Boolean(entry && !entry.isDeleted);
}

async function hasRepack(
  appId: string,
  downloadSourceIds: string[]
): Promise<boolean> {
  try {
    const repacks = await HydraApi.get<GameRepack[]>(
      `/games/steam/${appId}/download-sources`,
      { take: 1, skip: 0, downloadSourceIds },
      { needsAuth: false }
    );
    return Array.isArray(repacks) && repacks.length > 0;
  } catch (error) {
    logger.warn(`[wishlist-reminders] sources check failed for ${appId}`, error);
    return false;
  }
}

/**
 * Watch wishlist games that have no repack yet and notify once a repack appears
 * in one of the user's sources. First sight of a game just records whether it
 * already had a repack ("na") or not ("watching"); a later transition from
 * "watching" to a repack becomes "available" and fires a one-off notification.
 * Games already in the library are skipped (they leave the wishlist anyway).
 */
export async function checkWishlistReminders(): Promise<void> {
  const games = await wishlistGamesSublevel.values().all();

  // Only games not yet resolved or still waiting are worth a network check.
  const candidates = games.filter(
    (game) =>
      game.reminderState === undefined || game.reminderState === "watching"
  );
  if (candidates.length === 0) return;

  const downloadSourceIds = (await downloadSourcesSublevel.values().all()).map(
    (source) => source.id
  );
  if (downloadSourceIds.length === 0) return;

  const becameAvailable: WishlistGame[] = [];
  const queue = [...candidates];

  const worker = async () => {
    for (;;) {
      const game = queue.shift();
      if (!game) break;
      if (await isInLibrary(game.appId)) continue;

      const repackExists = await hasRepack(game.appId, downloadSourceIds);

      let nextState = game.reminderState;
      if (game.reminderState === undefined) {
        nextState = repackExists ? "na" : "watching";
      } else if (game.reminderState === "watching" && repackExists) {
        nextState = "available";
      }

      if (nextState === game.reminderState) continue;

      // Re-read before writing: the record may have changed (metadata cache)
      // while we were on the network.
      const current = await wishlistGamesSublevel
        .get(game.appId)
        .catch(() => null);
      if (!current) continue;

      const updated: WishlistGame = {
        ...current,
        reminderState: nextState,
        becameAvailableAt:
          nextState === "available" ? Date.now() : current.becameAvailableAt,
      };
      await wishlistGamesSublevel.put(game.appId, updated);

      if (nextState === "available") becameAvailable.push(updated);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, candidates.length) }, worker)
  );

  for (const game of becameAvailable) {
    const payload: WishlistAvailablePayload = {
      appId: game.appId,
      title: game.title ?? game.appId,
    };
    WindowManager.mainWindow?.webContents.send(
      "on-wishlist-game-available",
      payload
    );
  }

  if (becameAvailable.length > 0) {
    logger.info(
      `[wishlist-reminders] ${becameAvailable.length} game(s) became available`
    );
  }
}
