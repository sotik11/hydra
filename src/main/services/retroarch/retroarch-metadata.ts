import { app } from "electron";
import { spawn } from "node:child_process";
import { createReadStream, existsSync, promises as fs } from "node:fs";
import path from "node:path";

import type { RetroArchPlatform } from "@types";

import { logger } from "../logger";
import { SystemPath } from "../system-path";
import { downloadToFile, removeFileQuietly } from "../download-to-file";
import { PLATFORM_TO_LAUNCHBOX_NAME } from "./retroarch-cores";

export interface RomMetadata {
  overview: string;
  developer: string;
  publisher: string;
  releaseDate: string;
  genres: string[];
}

interface MetadataEntry extends RomMetadata {
  name: string;
}

interface PlatformIndexFile {
  builtAt: number;
  games: Record<string, MetadataEntry>;
}

const METADATA_URL = "https://gamesdb.launchbox-app.com/Metadata.zip";
const XML_MEMBER = "Metadata.xml";
const METADATA_TTL_MS = 30 * 24 * 60 * 60 * 1000; // rebuild monthly

// LaunchBox platform name -> our RetroArchPlatform (only the ones we support).
const LAUNCHBOX_TO_PLATFORM = new Map<string, RetroArchPlatform>(
  (
    Object.entries(PLATFORM_TO_LAUNCHBOX_NAME) as [RetroArchPlatform, string][]
  ).map(([platform, name]) => [name, platform])
);

const metadataRoot = (): string =>
  path.join(SystemPath.getPath("userData"), "retroarch-metadata");

const platformFilePath = (platform: RetroArchPlatform): string =>
  path.join(metadataRoot(), `${platform}.json`);

// --- title normalization (validated against real GoodTools/No-Intro names) ---

const ROMAN: Record<string, string> = {
  ii: "2",
  iii: "3",
  iv: "4",
  vi: "6",
  vii: "7",
  viii: "8",
};

export const normalizeTitle = (value: string): string => {
  let x = value.toLowerCase().trim();
  x = x.replace(/^(.*),\s*(the|a|an)$/, "$2 $1"); // "lion king, the" -> "the lion king"
  x = x.replace(/&/g, " and ");
  x = x.replace(/\bversus\b/g, "vs");
  x = x
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return x
    .split(" ")
    .map((word) => ROMAN[word] ?? word)
    .join(" ");
};

// --- LaunchBox XML parsing ---------------------------------------------------

const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) =>
      String.fromCodePoint(parseInt(h, 16))
    )
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&amp;/g, "&");

const field = (block: string, tag: string): string => {
  const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? decodeEntities(m[1]).trim() : "";
};

const sevenZipBinary = (): string => {
  const name =
    process.platform === "win32"
      ? "7z.exe"
      : process.platform === "darwin"
        ? "7zz"
        : "7zzs";
  return app.isPackaged
    ? path.join(process.resourcesPath, name)
    : path.join(__dirname, "..", "..", "binaries", name);
};

const extractXmlMember = (zipPath: string, dest: string): Promise<void> =>
  new Promise((resolve, reject) => {
    const child = spawn(
      sevenZipBinary(),
      ["e", zipPath, XML_MEMBER, `-o${dest}`, "-y"],
      { windowsHide: true }
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`7z exited with code ${code}`))
    );
  });

const parseXmlToIndexes = async (
  xmlPath: string
): Promise<Map<RetroArchPlatform, Record<string, MetadataEntry>>> => {
  const indexes = new Map<RetroArchPlatform, Record<string, MetadataEntry>>();

  const addEntry = (
    platform: RetroArchPlatform,
    entry: MetadataEntry
  ): void => {
    let games = indexes.get(platform);
    if (!games) {
      games = {};
      indexes.set(platform, games);
    }
    const key = normalizeTitle(entry.name);
    const prev = games[key];
    // keep the richer entry (longer overview) on collisions
    if (!prev || entry.overview.length > prev.overview.length) {
      games[key] = entry;
    }
  };

  await new Promise<void>((resolve, reject) => {
    let buffer = "";
    const stream = createReadStream(xmlPath, {
      encoding: "utf8",
      highWaterMark: 1 << 20,
    });
    stream.on("error", reject);
    stream.on("data", (chunk) => {
      buffer += chunk;
      for (;;) {
        const start = buffer.indexOf("<Game>");
        if (start === -1) {
          if (buffer.length > 1 << 20) buffer = buffer.slice(-16);
          break;
        }
        const end = buffer.indexOf("</Game>", start);
        if (end === -1) break;
        const block = buffer.slice(start, end + "</Game>".length);
        buffer = buffer.slice(end + "</Game>".length);

        const platform = LAUNCHBOX_TO_PLATFORM.get(field(block, "Platform"));
        if (!platform) continue;
        const name = field(block, "Name");
        if (!name) continue;
        addEntry(platform, {
          name,
          overview: field(block, "Overview"),
          developer: field(block, "Developer"),
          publisher: field(block, "Publisher"),
          releaseDate: field(block, "ReleaseDate"),
          genres: field(block, "Genres")
            .split(";")
            .map((g) => g.trim())
            .filter(Boolean),
        });
      }
    });
    stream.on("end", () => resolve());
  });

  return indexes;
};

// --- index build (download -> extract -> parse -> per-platform JSON) ---------

const isFresh = async (platform: RetroArchPlatform): Promise<boolean> => {
  try {
    const raw = await fs.readFile(platformFilePath(platform), "utf-8");
    const parsed = JSON.parse(raw) as PlatformIndexFile;
    return (
      typeof parsed.builtAt === "number" &&
      Date.now() - parsed.builtAt < METADATA_TTL_MS &&
      Boolean(parsed.games)
    );
  } catch {
    return false;
  }
};

let buildPromise: Promise<void> | null = null;

const buildIndexes = async (): Promise<void> => {
  const root = metadataRoot();
  const work = path.join(root, "_build");
  const zipPath = path.join(work, "Metadata.zip");
  const xmlPath = path.join(work, XML_MEMBER);

  try {
    await fs.mkdir(work, { recursive: true });

    logger.info(
      "Building RetroArch metadata index: downloading LaunchBox data"
    );
    await downloadToFile(METADATA_URL, zipPath, () => {});

    logger.info("Building RetroArch metadata index: extracting XML");
    await extractXmlMember(zipPath, work);
    if (!existsSync(xmlPath))
      throw new Error("Metadata.xml missing after extract");

    logger.info("Building RetroArch metadata index: parsing");
    const indexes = await parseXmlToIndexes(xmlPath);

    const builtAt = Date.now();
    const summary: Record<string, number> = {};
    for (const [platform, games] of indexes) {
      const payload: PlatformIndexFile = { builtAt, games };
      await fs.writeFile(platformFilePath(platform), JSON.stringify(payload));
      loadedIndexes.delete(platform); // force reload from fresh file
      summary[platform] = Object.keys(games).length;
    }
    logger.info("RetroArch metadata index built", summary);
  } finally {
    await removeFileQuietly(zipPath);
    await removeFileQuietly(xmlPath);
    await fs.rm(work, { recursive: true, force: true }).catch(() => {});
  }
};

/**
 * Ensures the LaunchBox metadata index is present and fresh for the given
 * platforms, building it (download + parse, ~monthly) if needed. Heavy but
 * one-time; safe to call on every scan — a fresh index short-circuits, and
 * concurrent calls share a single build. Failures are swallowed (lookups just
 * return null and callers keep the stub description).
 */
export const ensureMetadataIndexes = async (
  platforms: RetroArchPlatform[]
): Promise<void> => {
  const targets = platforms.filter((p) =>
    LAUNCHBOX_TO_PLATFORM.has(PLATFORM_TO_LAUNCHBOX_NAME[p])
  );
  if (targets.length === 0) return;

  const freshness = await Promise.all(targets.map(isFresh));
  if (freshness.every(Boolean)) return;

  if (!buildPromise) {
    buildPromise = buildIndexes()
      .catch((error) => {
        logger.warn("Failed to build RetroArch metadata index", error);
      })
      .finally(() => {
        buildPromise = null;
      });
  }
  await buildPromise;
};

// --- lookup ------------------------------------------------------------------

const loadedIndexes = new Map<
  RetroArchPlatform,
  Promise<Map<string, MetadataEntry> | null>
>();

const loadIndex = (
  platform: RetroArchPlatform
): Promise<Map<string, MetadataEntry> | null> => {
  const cached = loadedIndexes.get(platform);
  if (cached) return cached;

  const promise = (async () => {
    try {
      const raw = await fs.readFile(platformFilePath(platform), "utf-8");
      const parsed = JSON.parse(raw) as PlatformIndexFile;
      return new Map(Object.entries(parsed.games));
    } catch {
      return null;
    }
  })();

  loadedIndexes.set(platform, promise);
  return promise;
};

export const lookupMetadata = async (
  platform: RetroArchPlatform,
  cleanTitle: string
): Promise<RomMetadata | null> => {
  const index = await loadIndex(platform);
  if (!index) return null;

  const key = normalizeTitle(cleanTitle);
  const exact = index.get(key);
  if (exact) return exact;

  // fallback: a single "<title> ..." prefix match (e.g. dropped subtitle)
  let match: MetadataEntry | null = null;
  for (const [candidate, entry] of index) {
    if (!candidate.startsWith(`${key} `)) continue;
    if (match) return null; // ambiguous -> give up rather than guess wrong
    match = entry;
  }
  return match;
};
