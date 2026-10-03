import { restoreLocalGameSetup } from "./local-game-setup";

/**
 * Fork hooks that must run every time the library has been merged with the
 * server (startup, sign-in, periodic sync). Kept in one fork-owned place so
 * upstream's mergeWithRemoteGames only needs a single call.
 */
export const runForkPostMergeHooks = async (): Promise<void> => {
  // Put back executable paths / launch options remembered at sign-out.
  await restoreLocalGameSetup().catch(() => {});

  // The Nexus match map is rebuilt from the library; the cloud sync repopulates
  // the library after a relogin, so re-match once it is populated (a
  // startup-only match would run on the still-empty library and wipe the map).
  // Dynamic import avoids a static cycle with the nexus-mods service.
  await import("../nexus-mods/match-library")
    .then((m) => m.matchLibraryFromCache())
    .catch(() => {});
};
