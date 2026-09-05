import {
  gamesSublevel,
  levelKeys,
  steamLibraryImportAppIdsSublevel,
} from "@main/level";

// Persist the set of Steam-owned appIds we imported into the library. Kept in our
// OWN sublevel (survives logout, cloud library-sync and rebuilds — unlike the
// `steamLibraryImport` flag on the shared game record, which cloud sync overwrites).
export const recordImportedAppIds = async (appIds: string[]) => {
  if (appIds.length === 0) return;
  await steamLibraryImportAppIdsSublevel.batch(
    appIds.map((appId) => ({ type: "put" as const, key: appId, value: true }))
  );
};

// Re-apply the `steamLibraryImport` flag to library games from our persisted set.
// Called after every remote-library merge (startup, relogin, refresh) so the flag
// self-heals when Hydra's cloud sync recreates game records without it. Never
// creates or resurrects games — only stamps existing, non-deleted records.
export const restampSteamLibraryImport = async () => {
  const appIds = await steamLibraryImportAppIdsSublevel
    .keys()
    .all()
    .catch(() => [] as string[]);

  for (const appId of appIds) {
    const gameKey = levelKeys.game("steam", appId);
    const game = await gamesSublevel.get(gameKey).catch(() => null);
    if (!game || game.isDeleted || game.steamLibraryImport) continue;
    await gamesSublevel.put(gameKey, { ...game, steamLibraryImport: true });
  }
};
