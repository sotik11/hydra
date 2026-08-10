import axios from "axios";
import { createHash } from "node:crypto";
import { existsSync, promises as fs } from "node:fs";
import https from "node:https";
import path from "node:path";

import type { RetroArchPlatform, SteamAchievement } from "@types";
import type { RetroAchievementsApiAchievement } from "../retro-achievements/retro-achievements-client";

import { logger } from "../logger";
import { SystemPath } from "../system-path";

// --- RA rom hashing (Genesis / Mega Drive) ----------------------------------
// RA's Mega Drive hash is the MD5 of the raw ROM. .smd copier dumps carry a
// 512-byte header and are byte-interleaved in 16 KB blocks — de-interleave them
// first. Verified against No-Intro/RA for both .bin and .smd.

const SMD_HEADER = 512;
const SMD_BLOCK = 16384;
const SMD_HALF = SMD_BLOCK / 2;

const looksLikeSmd = (raw: Buffer): boolean =>
  raw.length % SMD_BLOCK === SMD_HEADER && raw[8] === 0xaa && raw[9] === 0xbb;

const deinterleaveSmd = (raw: Buffer): Buffer => {
  const body = raw.subarray(SMD_HEADER);
  const out = Buffer.alloc(body.length);
  let o = 0;
  for (let off = 0; off + SMD_BLOCK <= body.length; off += SMD_BLOCK) {
    const oddHalf = body.subarray(off, off + SMD_HALF);
    const evenHalf = body.subarray(off + SMD_HALF, off + SMD_BLOCK);
    for (let i = 0; i < SMD_HALF; i++) {
      out[o++] = evenHalf[i];
      out[o++] = oddHalf[i];
    }
  }
  const tail = body.length % SMD_BLOCK;
  if (tail) {
    body.subarray(body.length - tail).copy(out, o);
    o += tail;
  }
  return out.subarray(0, o);
};

const computeGenesisRaHash = async (
  romPath: string
): Promise<string | null> => {
  try {
    const raw = await fs.readFile(romPath);
    const data = looksLikeSmd(raw) ? deinterleaveSmd(raw) : raw;
    return createHash("md5").update(data).digest("hex").toLowerCase();
  } catch (error) {
    logger.warn("Failed to compute RA hash", { romPath, error });
    return null;
  }
};

// --- RA game-id resolution (hash -> RA game id) -----------------------------

// RA console ids. Only genesis is wired: its hash algorithm is validated; other
// platforms use a different RA hash and are left for later.
const RA_CONSOLE_ID: Partial<Record<RetroArchPlatform, number>> = {
  genesis: 1, // Mega Drive
};

export const isRetroAchievementsPlatform = (
  platform: RetroArchPlatform
): boolean => RA_CONSOLE_ID[platform] !== undefined;

export interface RaCredentials {
  username: string;
  webApiKey: string;
}

const RA_MAP_TTL_MS = 7 * 24 * 60 * 60 * 1000; // refresh weekly
const RA_TIMEOUT_MS = 30_000;

const raClient = axios.create({
  baseURL: "https://retroachievements.org/API",
  httpsAgent: new https.Agent({ family: 4 }),
  timeout: RA_TIMEOUT_MS,
});

interface RaGameIdCache {
  builtAt: number;
  map: Record<string, number>;
}

const gameIdCacheFile = (platform: RetroArchPlatform): string =>
  path.join(
    SystemPath.getPath("userData"),
    "retroarch-metadata",
    `ra-gameids-${platform}.json`
  );

const memoryMaps = new Map<
  RetroArchPlatform,
  Promise<Map<string, number> | null>
>();

const fetchGameIdMap = async (
  consoleId: number,
  credentials: RaCredentials
): Promise<Record<string, number> | null> => {
  try {
    const { data } = await raClient.get<{ ID: number; Hashes?: string[] }[]>(
      "/API_GetGameList.php",
      {
        params: {
          u: credentials.username,
          y: credentials.webApiKey,
          i: consoleId,
          h: 1, // include supported hashes
          f: 1, // only games that have achievements
        },
      }
    );
    if (!Array.isArray(data)) return null;
    const map: Record<string, number> = {};
    for (const game of data) {
      for (const hash of game.Hashes ?? []) {
        map[hash.toLowerCase()] = game.ID;
      }
    }
    return Object.keys(map).length > 0 ? map : null;
  } catch (error) {
    logger.warn("Failed to fetch RA game list", { consoleId, error });
    return null;
  }
};

const loadGameIdMap = (
  platform: RetroArchPlatform,
  credentials: RaCredentials
): Promise<Map<string, number> | null> => {
  const consoleId = RA_CONSOLE_ID[platform];
  if (consoleId === undefined) return Promise.resolve(null);

  const inflight = memoryMaps.get(platform);
  if (inflight) return inflight;

  const promise = (async () => {
    const file = gameIdCacheFile(platform);

    const readCache = async (): Promise<RaGameIdCache | null> => {
      try {
        const parsed = JSON.parse(
          await fs.readFile(file, "utf-8")
        ) as RaGameIdCache;
        return parsed?.map ? parsed : null;
      } catch {
        return null;
      }
    };

    const cached = await readCache();
    if (cached && Date.now() - cached.builtAt < RA_MAP_TTL_MS) {
      return new Map(Object.entries(cached.map));
    }

    const fresh = await fetchGameIdMap(consoleId, credentials);
    if (fresh) {
      await fs.mkdir(path.dirname(file), { recursive: true }).catch(() => {});
      await fs
        .writeFile(
          file,
          JSON.stringify({
            builtAt: Date.now(),
            map: fresh,
          } satisfies RaGameIdCache)
        )
        .catch(() => {});
      return new Map(Object.entries(fresh));
    }

    // Network failed: fall back to a stale cache if present.
    return cached?.map ? new Map(Object.entries(cached.map)) : null;
  })();

  memoryMaps.set(platform, promise);
  return promise;
};

/**
 * Resolves the RetroAchievements game id for a rom (currently Genesis only) by
 * hashing it and looking it up in the cached RA hash->id map. Returns null when
 * the platform is unsupported, the rom has no achievements set, or credentials
 * are missing/invalid. The id lets Hydra's existing achievements panel render
 * for the game exactly as it does for backend-provided platforms.
 */
export const resolveRaGameId = async (
  platform: RetroArchPlatform,
  romPath: string,
  credentials: RaCredentials
): Promise<number | null> => {
  if (platform !== "genesis") return null;
  if (!existsSync(romPath)) return null;

  const map = await loadGameIdMap(platform, credentials);
  if (!map) return null;

  const hash = await computeGenesisRaHash(romPath);
  if (!hash) return null;

  return map.get(hash) ?? null;
};

// --- catalogue mapper (RA definitions -> Hydra catalogue) --------------------
// Used by the one upstream hook in retro-achievements-sync: when the backend
// catalogue is empty (our local entries), build it from RA's own achievement
// definitions so the panel has a list to render.

const RA_BADGE_BASE = "https://media.retroachievements.org/Badge/";

export const buildCatalogueFromRa = (
  achievements: RetroAchievementsApiAchievement[]
): SteamAchievement[] =>
  achievements.map((achievement) => ({
    name: String(achievement.ID),
    displayName: achievement.Title,
    description: achievement.Description,
    icon: `${RA_BADGE_BASE}${achievement.BadgeName}.png`,
    icongray: `${RA_BADGE_BASE}${achievement.BadgeName}_lock.png`,
    hidden: false,
    points: achievement.Points,
  }));
