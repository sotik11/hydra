import fs from "node:fs";

import {
  gamesSublevel,
  localGameSetupSublevel,
  type LocalGameSetup,
} from "@main/level";
import { logger } from "@main/services/logger";
import { WindowManager } from "@main/services/window-manager";
import { AchievementWatcherManager } from "@main/services/achievements/achievement-watcher-manager";
import type { Game } from "@types";

const SETUP_FIELDS = [
  "executablePath",
  "launchOptions",
  "winePrefixPath",
  "protonPath",
  "autoRunMangohud",
  "autoRunGamemode",
  "automaticCloudSync",
  "installedSizeInBytes",
] as const satisfies readonly (keyof LocalGameSetup & keyof Game)[];

const isSet = (value: unknown) =>
  value !== undefined && value !== null && value !== "" && value !== false;

const pickSetup = (game: Game): LocalGameSetup | null => {
  const setup: Record<string, unknown> = {};
  for (const field of SETUP_FIELDS) {
    if (isSet(game[field])) setup[field] = game[field];
  }
  return Object.keys(setup).length > 0 ? (setup as LocalGameSetup) : null;
};

/**
 * Sign-out is about to wipe the library: remember the machine-local setup of
 * every game that has one, so it can be restored after the next sign-in.
 */
export const rememberLocalGameSetup = async (
  entries: [string, Game][]
): Promise<void> => {
  const operations = entries.flatMap(([key, game]) => {
    const setup = pickSetup(game);
    return setup ? [{ type: "put" as const, key, value: setup }] : [];
  });

  if (operations.length === 0) return;

  await localGameSetupSublevel.batch(operations);
  logger.info("[local-game-setup] remembered before sign-out", {
    games: operations.length,
  });
};

/**
 * The library is back from the server: restore the remembered setup for games
 * that lost it. Fields the game already has are never overwritten, and an
 * executable path is only restored while the file still exists. Entries for
 * games that are not in the library yet are kept for later.
 */
export const restoreLocalGameSetup = async (): Promise<void> => {
  const saved = await localGameSetupSublevel.iterator().all();
  if (saved.length === 0) return;

  let restored = 0;

  for (const [key, setup] of saved) {
    const game = await gamesSublevel.get(key).catch(() => null);
    if (!game || game.isDeleted) continue;

    const patch: Record<string, unknown> = {};
    for (const field of SETUP_FIELDS) {
      if (!isSet(setup[field]) || isSet(game[field])) continue;
      if (
        field === "executablePath" &&
        !fs.existsSync(setup[field] as string)
      ) {
        continue;
      }
      patch[field] = setup[field];
    }

    // installedSizeInBytes describes the executable's folder — meaningless
    // without the executable itself.
    if (!isSet(game.executablePath) && !("executablePath" in patch)) {
      delete patch.installedSizeInBytes;
    }

    if (Object.keys(patch).length > 0) {
      await gamesSublevel.put(key, { ...game, ...patch } as Game);
      restored += 1;

      if ("executablePath" in patch) {
        void AchievementWatcherManager.syncGameAchievementFiles(
          game.shop,
          game.objectId
        );
      }
    }

    await localGameSetupSublevel.del(key).catch(() => {});
  }

  if (restored > 0) {
    logger.info("[local-game-setup] restored after sign-in", {
      games: restored,
    });
    WindowManager.sendToAppWindows("on-library-batch-complete");
  }
};
