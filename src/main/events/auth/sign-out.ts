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
import { rememberLocalGameSetup } from "@main/services/library-sync/local-game-setup";
import {
  downloadLayoutStateSublevel,
  downloadsSublevel,
  gamesSublevel,
} from "@main/level";

/**
 * Clears account-owned games on sign-out but keeps local RetroArch rom entries
 * (`local-` ids): those describe files on this machine, not the account, and
 * are never synced to the profile — so a plain clear would delete them for good
 * (unlike catalogue-matched games, which come back on the next login sync).
 * They are hidden from the library while signed out (see get-library.ts).
 */
const clearAccountGames = async () => {
  const entries = await gamesSublevel.iterator().all();

  // Executable paths and launch options are facts about this machine, not the
  // account: remember them so the next sign-in can put them back.
  await rememberLocalGameSetup(entries).catch(() => {});

  const deletions = entries
    .filter(([, game]) => !retroarch.isLocalRetroArchEntryId(game.objectId))
    .map(([key]) => ({ type: "del" as const, key }));
  if (deletions.length > 0) await gamesSublevel.batch(deletions);
};

const signOut = async (_event: Electron.IpcMainInvokeEvent) => {
  SSEClient.close();

  /* Cancels any ongoing downloads */
  DownloadManager.cancelDownload();

  await HydraApi.handleSignOut(async () => {
    /* Removes all games being played */
    clearGamesPlaytimeState();

    const results = await Promise.allSettled([
      clearAccountGames(),
      downloadsSublevel.clear(),
      downloadLayoutStateSublevel.clear(),
      emulators.resetEmulatorScanData(),
      retroarch.resetRetroArchScanData(),
    ]);
    const failed = results.find((result) => result.status === "rejected");
    if (failed?.status === "rejected") throw failed.reason;
  });

  /* The friends and chat windows are only meaningful while signed in */
  if (!HydraApi.isLoggedIn()) {
    WindowManager.closeFriendsWindow();
    WindowManager.closeChatWindow();
  }
};

registerEvent("signOut", signOut);
