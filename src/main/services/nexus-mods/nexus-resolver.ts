import { formatName } from "@shared";
import type { NexusGameLite, NexusMatch } from "@types";

// Standalone edition-ish words that Hydra's formatName leaves in place (it only
// strips the "<word> Edition" form). Dropping them lets "Alan Wake" match
// "Alan Wake Remastered", etc.
const EXTRA_WORDS = new Set([
  "remastered",
  "remaster",
  "enhanced",
  "definitive",
  "goty",
  "complete",
  "deluxe",
  "ultimate",
]);

const stripExtraWords = (normalized: string): string =>
  normalized
    .split(" ")
    .filter((word) => !EXTRA_WORDS.has(word))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

const noSpace = (value: string): string => value.replace(/\s+/g, "");

export interface NexusIndex {
  bySpace: Map<string, NexusGameLite>;
  byNoSpace: Map<string, NexusGameLite>;
  byDomain: Map<string, NexusGameLite>;
  // Normalized full names, longest-first, for prefix matching.
  spaceList: { key: string; game: NexusGameLite }[];
}

// On a normalized-key collision, keep the game with the most mods — it's the
// canonical/most-active page (e.g. "Silent Hill 2" 327 mods over the
// "Director's Cut" variant with 54).
function keepRicher(
  map: Map<string, NexusGameLite>,
  key: string,
  game: NexusGameLite
) {
  const existing = map.get(key);
  if (!existing || game.mods > existing.mods) map.set(key, game);
}

export function buildNexusIndex(games: NexusGameLite[]): NexusIndex {
  const bySpace = new Map<string, NexusGameLite>();
  const byNoSpace = new Map<string, NexusGameLite>();
  const byDomain = new Map<string, NexusGameLite>();
  const spaceList: { key: string; game: NexusGameLite }[] = [];

  for (const game of games) {
    const normalized = formatName(game.name);
    const stripped = stripExtraWords(normalized);

    for (const key of [normalized, stripped]) {
      if (!key) continue;
      keepRicher(bySpace, key, game);
      keepRicher(byNoSpace, noSpace(key), game);
    }

    byDomain.set(String(game.domainName).toLowerCase(), game);
    if (normalized) spaceList.push({ key: normalized, game });
  }

  // Longest names first so prefix matching prefers the most specific title.
  spaceList.sort((a, b) => b.key.length - a.key.length);

  return { bySpace, byNoSpace, byDomain, spaceList };
}

/**
 * Resolve a game title to its Nexus match, or null when nothing bites. Mirrors
 * the offline matcher validated on the real library (28/31 favorites; the misses
 * genuinely aren't on Nexus): exact -> edition-stripped -> no-space/domain ->
 * "Nexus name is a prefix of the title" (The Witcher 3 in The Witcher 3: Wild
 * Hunt).
 */
export function resolveGameToNexus(
  title: string,
  index: NexusIndex
): NexusMatch | null {
  const normalized = formatName(title);
  if (!normalized) return null;

  const stripped = stripExtraWords(normalized);

  const hit =
    index.bySpace.get(normalized) ??
    index.bySpace.get(stripped) ??
    index.byNoSpace.get(noSpace(normalized)) ??
    index.byNoSpace.get(noSpace(stripped)) ??
    index.byDomain.get(noSpace(stripped)) ??
    prefixMatch(normalized, index);

  if (!hit) return null;

  return { domain: hit.domainName, name: hit.name, mods: hit.mods };
}

function prefixMatch(
  normalized: string,
  index: NexusIndex
): NexusGameLite | null {
  for (const { key, game } of index.spaceList) {
    if (key.length < 6) continue;
    if (normalized === key || normalized.startsWith(`${key} `)) return game;
  }
  return null;
}
