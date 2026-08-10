import { existsSync } from "node:fs";

import { gamesSublevel, levelKeys } from "@main/level";
import type { ClassicsDisc, Game, RetroArchPlatform } from "@types";

import { logger } from "../logger";
import { PLATFORM_TO_LAUNCHBOX_NAME } from "./retroarch-cores";

// Platforms whose CRC32 the Hydra backend (shop-details) actually indexes.
// Anything outside this set (currently: genesis) is never sent to the backend
// and always falls through to a local, backend-free library entry. Verified
// against the live endpoint: the six below return HTTP 200, Sega returns 400.
export const BACKEND_MATCH_PLATFORMS: ReadonlySet<RetroArchPlatform> =
  new Set<RetroArchPlatform>(["nes", "snes", "n64", "gb", "gbc", "gba"]);

// Local (unmatched) library entries use this objectId prefix so they can be
// told apart from real LaunchBox ids (which are numeric). Kept stable and
// deterministic (prefix + platform + CRC) so a rescan updates the same entry
// instead of duplicating it, and so the future migration that folds these into
// official entries — once upstream indexes the platform — can find them.
export const LOCAL_ENTRY_ID_PREFIX = "local-";

export const isLocalRetroArchEntryId = (objectId: string): boolean =>
  objectId.startsWith(LOCAL_ENTRY_ID_PREFIX);

const localEntryObjectId = (
  platform: RetroArchPlatform,
  crc32: string
): string => `${LOCAL_ENTRY_ID_PREFIX}${platform}-${crc32.toUpperCase()}`;

const baseNameWithoutExt = (fileName: string): string =>
  fileName.replace(/\.[^./\\]+$/, "");

// Turns "Sonic_the_Hedgehog_(JUE)_[!]" into "Sonic the Hedgehog": drop the
// extension, parenthesised/bracketed dump-and-region tags, and underscores.
const titleFromFileName = (fileName: string): string => {
  const cleaned = baseNameWithoutExt(fileName)
    .replace(/_+/g, " ")
    .replace(/\s*[([][^()[\]]*[)\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned || baseNameWithoutExt(fileName);
};

export interface LocalRomSource {
  folderPath: string;
  primaryPath: string;
  name: string;
  sizeBytes: number;
  platform: RetroArchPlatform;
  crc32: string | null;
}

export interface LocalEntriesResult {
  created: number;
  folderRollup: Map<string, { fileCount: number; sizeBytes: number }>;
  // primaryPaths that now have a (local) library entry — the caller uses this
  // to drop them from the "couldn't be matched" report, since they are no
  // longer lost: they are in the library, just without official metadata.
  persistedPaths: Set<string>;
}

/**
 * Persists scanned RetroArch roms that the backend could not (or would not)
 * match as minimal, launchable local library entries. This is what makes
 * Sega Genesis playable at all — the backend rejects that platform — and, as a
 * side effect, revives bootlegs / hacks / fan-translations of otherwise
 * supported platforms that are absent from the LaunchBox catalogue.
 *
 * Existing entries are updated in place (disc + housekeeping only) so playtime,
 * favourites and pins survive a rescan.
 */
export const persistUnmatchedRetroArchRoms = async (
  roms: LocalRomSource[],
  matchedCrcs: ReadonlySet<string>,
  backendMatchFailed: boolean
): Promise<LocalEntriesResult> => {
  const folderRollup = new Map<
    string,
    { fileCount: number; sizeBytes: number }
  >();
  const persistedPaths = new Set<string>();
  let created = 0;

  for (const rom of roms) {
    // already matched to a real LaunchBox entry → the normal path owns it
    if (rom.crc32 && matchedCrcs.has(rom.crc32.toUpperCase())) continue;
    // couldn't hash (unreadable/corrupt) → no stable id → leave it alone
    if (!rom.crc32) {
      logger.warn("Skipping local RetroArch entry with no CRC", {
        path: rom.primaryPath,
      });
      continue;
    }
    // For backend-indexed platforms, only fall back to a local entry when the
    // match round actually completed. Never on a transport failure — a passing
    // outage would otherwise spawn local dupes for the entire library.
    if (BACKEND_MATCH_PLATFORMS.has(rom.platform) && backendMatchFailed) {
      continue;
    }
    if (!existsSync(rom.primaryPath)) continue;

    const objectId = localEntryObjectId(rom.platform, rom.crc32);
    const gameKey = levelKeys.game("launchbox", objectId);
    const platformName = PLATFORM_TO_LAUNCHBOX_NAME[rom.platform];
    const disc: ClassicsDisc = {
      path: rom.primaryPath,
      label: titleFromFileName(rom.name),
      fileName: rom.name,
      sku: null,
    };

    const existing = await gamesSublevel.get(gameKey).catch(() => null);
    if (existing) {
      existing.isDeleted = false;
      existing.addedToLibraryAt ??= new Date();
      existing.discs = [disc];
      existing.selectedDiscPath = rom.primaryPath;
      existing.romSizeBytes = rom.sizeBytes;
      if (!existing.platform) existing.platform = platformName;
      await gamesSublevel.put(gameKey, existing);
    } else {
      const game: Game = {
        title: titleFromFileName(rom.name),
        iconUrl: null,
        libraryHeroImageUrl: null,
        logoImageUrl: null,
        objectId,
        shop: "launchbox",
        remoteId: null,
        isDeleted: false,
        playTimeInMilliseconds: 0,
        lastTimePlayed: null,
        addedToLibraryAt: new Date(),
        platform: platformName,
        discs: [disc],
        selectedDiscPath: rom.primaryPath,
        romSizeBytes: rom.sizeBytes,
      };
      await gamesSublevel.put(gameKey, game);
    }

    created += 1;
    persistedPaths.add(rom.primaryPath);
    const bucket = folderRollup.get(rom.folderPath) ?? {
      fileCount: 0,
      sizeBytes: 0,
    };
    bucket.fileCount += 1;
    bucket.sizeBytes += rom.sizeBytes;
    folderRollup.set(rom.folderPath, bucket);
  }

  if (created > 0) {
    logger.info("Persisted local RetroArch entries (no backend match)", {
      created,
    });
  }

  return { created, folderRollup, persistedPaths };
};
