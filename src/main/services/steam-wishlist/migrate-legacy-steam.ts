import {
  db,
  gamesSublevel,
  levelKeys,
  steamWishlistSublevel,
} from "@main/level";
import { logger } from "@main/services/logger";
import type { Game, UserPreferences } from "@types";

// One-off cleanup of the fork's pre-4.1.6 Steam integration (own SteamID / API
// key connect, own owned-games import), superseded by upstream's Steam
// integration. Safe to run on every start: it is a no-op once done.
const MIGRATION_KEY = "forkSteamMigration416";
const LEGACY_IMPORT_SUBLEVEL = "steamLibraryImportAppIds";
const LEGACY_PREFERENCE_KEYS = [
  "steamWishlistSteamId",
  "steamWishlistPersonaName",
  "steamWishlistAvatarUrl",
  "steamWishlistSyncedAt",
  "steamWishlistApiKey",
  "steamWishlistLibraryCount",
] as const;

type LegacyGame = Game & { steamLibraryImport?: boolean };

export async function migrateLegacyForkSteam(): Promise<void> {
  const done = await db
    .get<string, boolean>(MIGRATION_KEY, { valueEncoding: "json" })
    .catch(() => false);
  if (done) return;

  // 1) drop the legacy connect fields (incl. the stored Web API key)
  const preferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  if (preferences) {
    const cleaned = { ...preferences } as Record<string, unknown>;
    let changed = false;
    for (const key of LEGACY_PREFERENCE_KEYS) {
      if (key in cleaned) {
        delete cleaned[key];
        changed = true;
      }
    }
    if (changed) {
      await db.put(levelKeys.userPreferences, cleaned as UserPreferences, {
        valueEncoding: "json",
      });
    }
  }

  // 2) the old wishlist cache was keyed by SteamID64 with a bare item array
  await steamWishlistSublevel.clear().catch(() => {});

  // 3) forget the fork's own "imported from Steam" bookkeeping; upstream marks
  //    imported games itself (hasActiveSteamImport / source)
  await db
    .sublevel<string, boolean>(LEGACY_IMPORT_SUBLEVEL, {
      valueEncoding: "json",
    })
    .clear()
    .catch(() => {});

  let cleanedGames = 0;
  const batch = db.batch();
  for (const [key, game] of await gamesSublevel.iterator().all()) {
    const legacy = game as LegacyGame;
    if (legacy.steamLibraryImport === undefined) continue;

    const { steamLibraryImport: _dropped, ...rest } = legacy;
    batch.put(key, rest as Game, { sublevel: gamesSublevel });
    cleanedGames += 1;
  }
  if (cleanedGames > 0) await batch.write();

  await db.put(MIGRATION_KEY, true, { valueEncoding: "json" });
  logger.info("[steam-wishlist] legacy fork Steam data migrated", {
    cleanedGames,
  });
}
