import { gamesSublevel } from "@main/level";
import {
  nexusModsSublevel,
  NEXUS_MATCHES_KEY,
} from "@main/level/sublevels/nexus-mods";
import type { Game, NexusMatchMap } from "@types";
import { ensureNexusCatalogue } from "./nexus-catalogue";
import { buildNexusIndex, resolveGameToNexus } from "./nexus-resolver";

/**
 * Resolve every library game against the Nexus catalogue and persist the match
 * map (keyed by `${shop}:${objectId}`). Only games that resolve to a Nexus page
 * with mods are kept — that's exactly the gate the "Mods" button uses. Returns
 * the number of matched games.
 */
export async function matchLibraryToNexus(
  apiKey: string,
  now: number,
  forceCatalogue = false
): Promise<number> {
  const games = await ensureNexusCatalogue(apiKey, now, forceCatalogue);
  const index = buildNexusIndex(games);

  const matches: NexusMatchMap = {};

  for await (const [, game] of gamesSublevel.iterator()) {
    const libraryGame = game as Game;
    if (!libraryGame || libraryGame.isDeleted || !libraryGame.title) continue;

    const match = resolveGameToNexus(libraryGame.title, index);
    if (match && match.mods > 0) {
      matches[`${libraryGame.shop}:${libraryGame.objectId}`] = match;
    }
  }

  await nexusModsSublevel.put(NEXUS_MATCHES_KEY, matches).catch(() => {});

  return Object.keys(matches).length;
}

/** Read the stored match count (0 when nothing stored yet). */
export async function getNexusMatchCount(): Promise<number> {
  const matches =
    ((await nexusModsSublevel
      .get(NEXUS_MATCHES_KEY)
      .catch(() => null)) as NexusMatchMap | null) ?? {};
  return Object.keys(matches).length;
}
