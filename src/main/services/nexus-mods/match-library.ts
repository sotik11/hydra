import { gamesSublevel } from "@main/level";
import {
  nexusModsSublevel,
  NEXUS_MATCHES_KEY,
} from "@main/level/sublevels/nexus-mods";
import type { Game, NexusMatch, NexusMatchMap } from "@types";
import {
  ensureNexusCatalogue,
  readNexusCatalogueCache,
} from "./nexus-catalogue";
import {
  buildNexusIndex,
  resolveGameToNexus,
  type NexusIndex,
} from "./nexus-resolver";

// The built index is expensive relative to a single lookup, so memoize it and
// rebuild only when the cached catalogue changes (keyed by its fetchedAt).
let indexMemo: { fetchedAt: number; index: NexusIndex } | null = null;

/**
 * Build (or reuse) the Nexus index from the cached catalogue, without any
 * network. Returns null when there is no cached catalogue yet.
 */
async function loadCachedIndex(): Promise<NexusIndex | null> {
  const cached = await readNexusCatalogueCache();
  if (!cached) {
    indexMemo = null;
    return null;
  }

  if (!indexMemo || indexMemo.fetchedAt !== cached.fetchedAt) {
    indexMemo = {
      fetchedAt: cached.fetchedAt,
      index: buildNexusIndex(cached.games),
    };
  }

  return indexMemo.index;
}

/** Drop the in-memory index (called on disconnect). */
export function clearNexusIndexMemo() {
  indexMemo = null;
}

const matchKey = (game: Game) => `${game.shop}:${game.objectId}`;

async function readMatches(): Promise<NexusMatchMap> {
  return (
    ((await nexusModsSublevel
      .get(NEXUS_MATCHES_KEY)
      .catch(() => null)) as NexusMatchMap | null) ?? {}
  );
}

// Resolve every library game against a prebuilt index and persist the match map.
// Only games that resolve to a Nexus page with mods are kept — the same gate the
// "Mods" button uses. Returns the number of matched games.
async function runMatch(index: NexusIndex): Promise<number> {
  const matches: NexusMatchMap = {};

  for await (const [, game] of gamesSublevel.iterator()) {
    const libraryGame = game as Game;
    if (!libraryGame || libraryGame.isDeleted || !libraryGame.title) continue;

    const match = resolveGameToNexus(libraryGame.title, index);
    if (match && match.mods > 0) matches[matchKey(libraryGame)] = match;
  }

  await nexusModsSublevel.put(NEXUS_MATCHES_KEY, matches).catch(() => {});

  return Object.keys(matches).length;
}

/**
 * Full re-match. Ensures the catalogue is present (fetching when stale/forced),
 * then resolves the whole library. Used by connect/refresh.
 */
export async function matchLibraryToNexus(
  apiKey: string,
  now: number,
  forceCatalogue = false
): Promise<number> {
  const games = await ensureNexusCatalogue(apiKey, now, forceCatalogue);
  const index = buildNexusIndex(games);
  indexMemo = null; // catalogue may have changed; drop stale memo
  return runMatch(index);
}

/**
 * Full re-match using only the cached catalogue — no network, no key. Used on
 * startup so library changes made while disconnected/offline are reflected.
 * Returns null when there's no cached catalogue (nothing to do).
 */
export async function matchLibraryFromCache(): Promise<number | null> {
  const index = await loadCachedIndex();
  if (!index) return null;
  return runMatch(index);
}

/**
 * Incrementally update the match map for a single freshly-added game, using the
 * cached catalogue. No-op when there's no cached catalogue. Keeps the "Mods"
 * button and the settings count fresh without a full re-match.
 */
export async function updateNexusMatchForGame(game: Game): Promise<void> {
  if (!game?.title) return;

  const index = await loadCachedIndex();
  if (!index) return;

  const match = resolveGameToNexus(game.title, index);
  const matches = await readMatches();
  const key = matchKey(game);

  if (match && match.mods > 0) {
    matches[key] = match;
  } else {
    delete matches[key];
  }

  await nexusModsSublevel.put(NEXUS_MATCHES_KEY, matches).catch(() => {});
}

/** Read the stored match count (0 when nothing stored yet). */
export async function getNexusMatchCount(): Promise<number> {
  const matches = await readMatches();
  return Object.keys(matches).length;
}

/** The stored Nexus match for one library game, or null when it didn't match. */
export async function getNexusMatchForGame(
  shop: string,
  objectId: string
): Promise<NexusMatch | null> {
  const matches = await readMatches();
  return matches[`${shop}:${objectId}`] ?? null;
}
