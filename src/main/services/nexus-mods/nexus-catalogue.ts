import axios from "axios";

import {
  nexusModsSublevel,
  NEXUS_CATALOGUE_KEY,
} from "@main/level/sublevels/nexus-mods";
import type { NexusCatalogueCache, NexusGameLite } from "@types";
import { NEXUS_API_BASE, nexusHeaders } from "./nexus-mods";

const CATALOGUE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface RawNexusGame {
  id: number;
  name: string;
  domain_name: string;
  mods?: number;
}

/**
 * Pull the full Nexus games catalogue (~5k games) and trim it to what the
 * resolver needs. One ~1-2 MB call; cached afterwards.
 */
export async function fetchNexusCatalogue(
  apiKey: string
): Promise<NexusGameLite[]> {
  const { data } = await axios.get<RawNexusGame[]>(
    `${NEXUS_API_BASE}/games.json`,
    { headers: nexusHeaders(apiKey), timeout: 30000 }
  );

  if (!Array.isArray(data)) return [];

  return data
    .filter((game) => game?.id && game?.name && game?.domain_name)
    .map((game) => ({
      id: game.id,
      name: game.name,
      domainName: game.domain_name,
      mods: game.mods ?? 0,
    }));
}

async function readCatalogueCache(): Promise<NexusCatalogueCache | null> {
  return (
    ((await nexusModsSublevel
      .get(NEXUS_CATALOGUE_KEY)
      .catch(() => null)) as NexusCatalogueCache | null) ?? null
  );
}

/**
 * Return the cached catalogue when it's fresh, otherwise fetch and cache a new
 * one. `force` bypasses the freshness check (used by the manual refresh).
 */
export async function ensureNexusCatalogue(
  apiKey: string,
  now: number,
  force = false
): Promise<NexusGameLite[]> {
  if (!force) {
    const cached = await readCatalogueCache();
    if (cached && now - cached.fetchedAt < CATALOGUE_MAX_AGE_MS) {
      return cached.games;
    }
  }

  const games = await fetchNexusCatalogue(apiKey);
  await nexusModsSublevel
    .put(NEXUS_CATALOGUE_KEY, { fetchedAt: now, games } as NexusCatalogueCache)
    .catch(() => {});

  return games;
}
