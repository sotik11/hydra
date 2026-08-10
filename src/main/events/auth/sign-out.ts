import { registerEvent } from "../register-event";
import {
  DownloadManager,
  HydraApi,
  SSEClient,
  WindowManager,
  emulators,
  retroarch,
} from "@main/services";
import { clearGamesPlaytimeState } from "@main/services/game-running-state";
import {
  db,
  downloadLayoutStateSublevel,
  downloadsSublevel,
  gamesSublevel,
  levelKeys,
} from "@main/level";

/**
 * Clears account-owned games on sign-out but keeps local RetroArch rom entries
 * (`local-` ids): those describe files on this machine, not the account, and
 * are never synced to the profile — so a plain clear would delete them for good
 * (unlike catalogue-matched games, which come back on the next login sync).
 */
const clearAccountGames = async () => {
  const entries = await gamesSublevel.iterator().all();
  const deletions = entries
    .filter(([, game]) => !retroarch.isLocalRetroArchEntryId(game.objectId))
    .map(([key]) => ({ type: "del" as const, key }));
  if (deletions.length > 0) await gamesSublevel.batch(deletions);
};

const signOut = async (_event: Electron.IpcMainInvokeEvent) => {
  SSEClient.close();

  const databaseOperations = db
    .batch([
      {
        type: "del",
        key: levelKeys.auth,
      },
      {
        type: "del",
        key: levelKeys.user,
      },
    ])
    .then(() => {
      /* Removes all games being played */
      clearGamesPlaytimeState();

      return Promise.all([
        clearAccountGames(),
        downloadsSublevel.clear(),
        downloadLayoutStateSublevel.clear(),
        emulators.resetEmulatorScanData(),
      ]);
    });

  /* Cancels any ongoing downloads */
  DownloadManager.cancelDownload();

  await HydraApi.handleSignOut();

  /* The friends window is only meaningful while signed in */
  WindowManager.closeFriendsWindow();

  await Promise.all([
    databaseOperations,
    HydraApi.post("/auth/logout").catch(() => {}),
  ]);
};

registerEvent("signOut", signOut);
