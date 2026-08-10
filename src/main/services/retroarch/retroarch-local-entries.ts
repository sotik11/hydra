import { existsSync } from "node:fs";

import {
  gamesShopAssetsSublevel,
  gamesShopCacheSublevel,
  gamesSublevel,
  levelKeys,
} from "@main/level";
import type {
  ClassicsDisc,
  Game,
  RetroArchPlatform,
  ShopAssets,
  ShopDetails,
} from "@types";

import { logger } from "../logger";
import { PLATFORM_TO_LAUNCHBOX_NAME } from "./retroarch-cores";
import {
  ensureLocalBoxart,
  isBoxartSupportedPlatform,
} from "./retroarch-thumbnails";

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

// Compact SEGA wordmark shown for coverless Genesis entries instead of the
// generic controller icon. An <img>-embeddable SVG data URI — no bundled asset,
// nothing to touch in the renderer.
const SEGA_PLACEHOLDER_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">' +
  '<rect width="600" height="400" fill="#0b0e14"/>' +
  '<text x="300" y="215" text-anchor="middle" font-family="Arial Black, Arial, sans-serif" font-size="150" font-weight="900" font-style="italic" fill="#1f6feb" letter-spacing="-6">SEGA</text>' +
  '<text x="300" y="288" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" letter-spacing="12" fill="#7d8590">GENESIS</text>' +
  "</svg>";

const SEGA_PLACEHOLDER_ICON = `data:image/svg+xml,${encodeURIComponent(
  SEGA_PLACEHOLDER_SVG
)}`;

// Per-platform placeholder for coverless local entries. Platforms without an
// entry keep Hydra's default (generic) placeholder.
const PLATFORM_PLACEHOLDER_ICON: Partial<Record<RetroArchPlatform, string>> = {
  genesis: SEGA_PLACEHOLDER_ICON,
};

const COVER_CONCURRENCY = 8;

const runWithConcurrency = async <T>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<void>
): Promise<void> => {
  let cursor = 0;
  const runners = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        await worker(items[index]);
      }
    }
  );
  await Promise.all(runners);
};

const buildLocalAssets = (
  objectId: string,
  title: string,
  iconUrl: string | null
): ShopAssets => ({
  objectId,
  shop: "launchbox",
  title,
  iconUrl,
  libraryHeroImageUrl: null,
  libraryImageUrl: null,
  logoImageUrl: null,
  logoPosition: null,
  coverImageUrl: null,
  downloadSources: [],
});

const localDescription = (platformName: string, language: string): string => {
  const lang = language.slice(0, 2).toLowerCase();
  if (lang === "ru") {
    return `Локальный ROM (${platformName}), запускается через RetroArch. Магазинные метаданные недоступны.`;
  }
  if (lang === "uk") {
    return `Локальний ROM (${platformName}), запускається через RetroArch. Магазинні метадані недоступні.`;
  }
  return `Local ROM (${platformName}) launched through RetroArch. Store metadata is unavailable.`;
};

// A minimal ShopDetails cached for a local entry so the game-details page has a
// real payload (name, description, platform) instead of the backend returning
// null — which is what left the page without a description and glitched the
// hero. retroAchievementsGameId is 0: a number (so the details cache-gate
// accepts it) that downstream treats as "no RA mapping" (`if (!gameId)`).
const buildLocalShopDetails = (
  objectId: string,
  title: string,
  platformName: string,
  language: string
): ShopDetails => {
  const description = localDescription(platformName, language);
  return {
    objectId,
    descriptionLanguage: language,
    name: title,
    platform: platformName,
    skus: undefined,
    retroAchievementsGameId: 0,
    steam_appid: 0,
    detailed_description: description,
    about_the_game: description,
    short_description: description,
    developers: [],
    publishers: [],
    genres: [],
    movies: undefined,
    supported_languages: "",
    screenshots: [],
    pc_requirements: { minimum: "", recommended: "" },
    mac_requirements: { minimum: "", recommended: "" },
    linux_requirements: { minimum: "", recommended: "" },
    release_date: { coming_soon: false, date: "" },
    content_descriptors: { ids: [] },
  };
};

interface CoverTask {
  gameKey: string;
  platform: RetroArchPlatform;
  crc32: string;
  title: string;
  assets: ShopAssets;
}

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
  backendMatchFailed: boolean,
  language: string
): Promise<LocalEntriesResult> => {
  const folderRollup = new Map<
    string,
    { fileCount: number; sizeBytes: number }
  >();
  const persistedPaths = new Set<string>();
  const coverTasks: CoverTask[] = [];
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
    const title = titleFromFileName(rom.name);
    const placeholderIcon = PLATFORM_PLACEHOLDER_ICON[rom.platform] ?? null;
    const disc: ClassicsDisc = {
      path: rom.primaryPath,
      label: title,
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
      existing.iconUrl ??= placeholderIcon;
      if (!existing.platform) existing.platform = platformName;
      await gamesSublevel.put(gameKey, existing);
    } else {
      const game: Game = {
        title,
        iconUrl: placeholderIcon,
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

    // Write placeholder assets now so the icon shows immediately; the cover pass
    // below upgrades coverImageUrl to real box art when one resolves.
    const assets = buildLocalAssets(objectId, title, placeholderIcon);
    await gamesShopAssetsSublevel
      .put(gameKey, { ...assets, updatedAt: Date.now() })
      .catch((err) =>
        logger.warn("Failed to store local placeholder asset", { gameKey, err })
      );

    // Cache minimal shop details so the game-details page has a real payload
    // (name/description/platform) instead of the backend returning null.
    await gamesShopCacheSublevel
      .put(
        levelKeys.gameShopCacheItem("launchbox", objectId, language),
        buildLocalShopDetails(objectId, title, platformName, language)
      )
      .catch((err) =>
        logger.warn("Failed to cache local shop details", { gameKey, err })
      );

    if (isBoxartSupportedPlatform(rom.platform)) {
      coverTasks.push({
        gameKey,
        platform: rom.platform,
        crc32: rom.crc32,
        title,
        assets,
      });
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

  // Cover pass: download box art once per rom into the local cache. Cached
  // covers are reused with no network; entries whose cover is missing (never
  // downloaded, download failed, or the covers folder was unavailable) are
  // retried here on every scan and degrade to the placeholder icon meanwhile.
  if (coverTasks.length > 0) {
    logger.info("Resolving local RetroArch covers", {
      eligible: coverTasks.length,
    });
    let resolved = 0;
    await runWithConcurrency(coverTasks, COVER_CONCURRENCY, async (task) => {
      const coverUrl = await ensureLocalBoxart(
        task.platform,
        task.crc32,
        task.title
      ).catch(() => null);
      if (!coverUrl) return;
      // Use the box art as the cover AND the icon, so it also shows in places
      // that render iconUrl (the left sidebar list, the detected-roms list),
      // not just the grid.
      await gamesShopAssetsSublevel
        .put(task.gameKey, {
          ...task.assets,
          iconUrl: coverUrl,
          coverImageUrl: coverUrl,
          updatedAt: Date.now(),
        })
        .catch((err) =>
          logger.warn("Failed to store local cover asset", {
            gameKey: task.gameKey,
            err,
          })
        );
      const game = await gamesSublevel.get(task.gameKey).catch(() => null);
      if (game) {
        game.iconUrl = coverUrl;
        await gamesSublevel.put(task.gameKey, game).catch((err) =>
          logger.warn("Failed to update local game icon", {
            gameKey: task.gameKey,
            err,
          })
        );
      }
      resolved += 1;
    });
    logger.info("Local RetroArch cover pass done", {
      eligible: coverTasks.length,
      resolved,
      missing: coverTasks.length - resolved,
    });
  }

  return { created, folderRollup, persistedPaths };
};
