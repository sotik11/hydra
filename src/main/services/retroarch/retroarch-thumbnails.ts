import { existsSync, promises as fs } from "node:fs";
import path from "node:path";

import axios from "axios";

import type { RetroArchPlatform } from "@types";

import { logger } from "../logger";
import { SystemPath } from "../system-path";
import { downloadToFile, removeFileQuietly } from "../download-to-file";

// libretro-thumbnails system names (also the GitHub repo, spaces -> underscores).
// Covers the platforms we support; unknown platforms simply get no boxart.
const SYSTEM_DIR: Partial<Record<RetroArchPlatform, string>> = {
  nes: "Nintendo - Nintendo Entertainment System",
  snes: "Nintendo - Super Nintendo Entertainment System",
  n64: "Nintendo - Nintendo 64",
  gb: "Nintendo - Game Boy",
  gbc: "Nintendo - Game Boy Color",
  gba: "Nintendo - Game Boy Advance",
  genesis: "Sega - Mega Drive - Genesis",
};

const THUMBNAIL_HOST = "https://thumbnails.libretro.com";
const INDEX_TTL_MS = 7 * 24 * 60 * 60 * 1000; // refresh the name index weekly
const INDEX_TIMEOUT_MS = 30_000;
const DOWNLOAD_ATTEMPTS = 2;
const DOWNLOAD_RETRY_DELAY_MS = 400;

export const isBoxartSupportedPlatform = (
  platform: RetroArchPlatform
): boolean => SYSTEM_DIR[platform] !== undefined;

const coversRoot = (): string =>
  path.join(SystemPath.getPath("userData"), "retroarch-covers");

const indexFilePath = (platform: RetroArchPlatform): string =>
  path.join(coversRoot(), "index", `${platform}.json`);

export const coverFilePath = (
  platform: RetroArchPlatform,
  crc32: string
): string =>
  path.join(coversRoot(), platform, `${platform}-${crc32.toUpperCase()}.png`);

const toLocalUrl = (filePath: string): string =>
  `local:${filePath.replaceAll("\\", "/")}`;

// --- name index (cached locally, refreshed weekly) --------------------------

interface CachedIndex {
  fetchedAt: number;
  names: string[];
}

// Dedupe concurrent lookups within a run; the on-disk JSON is the durable cache.
const memoryIndex = new Map<RetroArchPlatform, Promise<string[] | null>>();

const fetchIndexFromGithub = async (
  systemDir: string
): Promise<string[] | null> => {
  const repo = systemDir.replace(/ /g, "_");
  try {
    const { data } = await axios.get<{
      tree: { path: string; type: string }[];
      truncated: boolean;
    }>(
      `https://api.github.com/repos/libretro-thumbnails/${encodeURIComponent(
        repo
      )}/git/trees/master?recursive=1`,
      {
        headers: {
          Accept: "application/vnd.github+json",
          "User-Agent": "HydraLauncher",
        },
        timeout: INDEX_TIMEOUT_MS,
      }
    );
    const names = data.tree
      .filter(
        (node) =>
          node.type === "blob" &&
          node.path.startsWith("Named_Boxarts/") &&
          node.path.toLowerCase().endsWith(".png")
      )
      .map((node) => node.path.slice("Named_Boxarts/".length, -".png".length));
    if (data.truncated) {
      logger.warn("libretro boxart index truncated", { systemDir });
    }
    return names.length > 0 ? names : null;
  } catch (error) {
    logger.warn("Failed to fetch libretro boxart index", { systemDir, error });
    return null;
  }
};

const readCachedIndex = async (file: string): Promise<CachedIndex | null> => {
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf-8")) as CachedIndex;
    if (Array.isArray(parsed.names) && typeof parsed.fetchedAt === "number") {
      return parsed;
    }
  } catch {
    // missing / invalid cache
  }
  return null;
};

const loadIndex = async (
  platform: RetroArchPlatform
): Promise<string[] | null> => {
  const systemDir = SYSTEM_DIR[platform];
  if (!systemDir) return null;

  const inflight = memoryIndex.get(platform);
  if (inflight) return inflight;

  const promise = (async () => {
    const file = indexFilePath(platform);

    const cached = await readCachedIndex(file);
    if (cached && Date.now() - cached.fetchedAt < INDEX_TTL_MS) {
      return cached.names;
    }

    const fresh = await fetchIndexFromGithub(systemDir);
    if (fresh) {
      await fs.mkdir(path.dirname(file), { recursive: true }).catch(() => {});
      await fs
        .writeFile(
          file,
          JSON.stringify({
            fetchedAt: Date.now(),
            names: fresh,
          } satisfies CachedIndex)
        )
        .catch(() => {});
      return fresh;
    }

    // Network failed: fall back to a stale cache if we still have one.
    return cached?.names ?? null;
  })();

  memoryIndex.set(platform, promise);
  return promise;
};

// --- title -> boxart name matching ------------------------------------------

const normalize = (value: string): string =>
  value.toLowerCase().replace(/\s+/g, " ").trim();

// Region/dump ranking: prefer a clean US/World release over Japan/betas/hacks.
const scoreName = (name: string): number => {
  const lower = name.toLowerCase();
  let score = 0;
  if (/\busa\b/.test(lower)) score += 100;
  if (/\bworld\b/.test(lower)) score += 80;
  if (/\beurope\b/.test(lower)) score += 60;
  if (/\bjapan\b/.test(lower)) score += 40;
  if (
    /beta|proto|demo|sample|virtual console|hack|aftermarket|pirate/.test(lower)
  ) {
    score -= 200;
  }
  score -= name.match(/\(/g)?.length ?? 0; // fewer parentheticals = cleaner
  return score;
};

const matchBoxartName = (
  names: string[],
  cleanTitle: string
): string | null => {
  const target = normalize(cleanTitle);
  if (!target) return null;

  let best: string | null = null;
  let bestScore = -Infinity;
  for (const name of names) {
    const lower = normalize(name);
    // Exact, or "<title> (<region>...)". The trailing " (" guard stops
    // "Aladdin" from matching "Aladdin 2 (USA)".
    if (lower !== target && !lower.startsWith(`${target} (`)) continue;
    const score = scoreName(name) + (lower === target ? 5 : 0);
    if (score > bestScore) {
      bestScore = score;
      best = name;
    }
  }
  return best;
};

const boxartUrl = (systemDir: string, name: string): string =>
  `${THUMBNAIL_HOST}/${encodeURIComponent(systemDir)}/Named_Boxarts/${encodeURIComponent(
    name
  )}.png`;

const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Resolves a local box-art file for a rom, building a persistent on-disk cache
 * under userData/retroarch-covers. The remote server is contacted only the
 * first time a rom is seen (or after a previous download failed / the file went
 * missing); a cached file is reused with no network. Returns a `local:` url the
 * renderer can display, or null when there is no match, the download failed, or
 * the covers folder is unavailable — in which case the caller falls back to the
 * platform placeholder / default icon.
 */
export const ensureLocalBoxart = async (
  platform: RetroArchPlatform,
  crc32: string,
  cleanTitle: string
): Promise<string | null> => {
  const systemDir = SYSTEM_DIR[platform];
  if (!systemDir) return null;

  const dest = coverFilePath(platform, crc32);

  // Already cached on disk -> reuse, never hit the network again.
  try {
    if (existsSync(dest)) return toLocalUrl(dest);
  } catch {
    // covers folder unavailable -> treat as missing, fall through
  }

  const names = await loadIndex(platform);
  if (!names) return null;

  const matched = matchBoxartName(names, cleanTitle);
  if (!matched) return null;

  const url = boxartUrl(systemDir, matched);
  for (let attempt = 1; attempt <= DOWNLOAD_ATTEMPTS; attempt++) {
    try {
      await downloadToFile(url, dest, () => {});
      if (existsSync(dest)) return toLocalUrl(dest);
    } catch (error) {
      await removeFileQuietly(dest); // drop any partial/corrupt file
      logger.warn("Failed to download libretro boxart", {
        platform,
        cleanTitle,
        matched,
        attempt,
        error,
      });
      if (attempt < DOWNLOAD_ATTEMPTS) await delay(DOWNLOAD_RETRY_DELAY_MS);
    }
  }
  return null;
};
