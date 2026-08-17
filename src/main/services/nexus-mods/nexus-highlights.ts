import axios from "axios";

import type { NexusHighlights, NexusModCard } from "@types";
import { NEXUS_API_BASE, nexusHeaders } from "./nexus-mods";

interface RawMod {
  mod_id: number;
  name?: string;
  summary?: string;
  author?: string;
  uploaded_by?: string;
  endorsement_count?: number;
  picture_url?: string | null;
  updated_timestamp?: number;
  available?: boolean;
  status?: string;
}

const HIGHLIGHT_LIMIT = 9; // 3×3 grid — no orphan row, leaves room for the CTA

function toCard(mod: RawMod): NexusModCard {
  return {
    modId: mod.mod_id,
    name: mod.name ?? "",
    summary: mod.summary ?? "",
    author: mod.author ?? mod.uploaded_by ?? "",
    endorsements: mod.endorsement_count ?? 0,
    pictureUrl: mod.picture_url ?? null,
    updatedAt: mod.updated_timestamp ?? 0,
  };
}

async function fetchModList(
  apiKey: string,
  domain: string,
  category: "trending" | "latest_added" | "latest_updated"
): Promise<NexusModCard[]> {
  try {
    const { data } = await axios.get<RawMod[]>(
      `${NEXUS_API_BASE}/games/${domain}/mods/${category}.json`,
      { headers: nexusHeaders(apiKey), timeout: 15000 }
    );

    if (!Array.isArray(data)) return [];

    return data
      .filter(
        (mod) =>
          mod?.mod_id &&
          mod.name &&
          mod.available !== false &&
          (mod.status ?? "published") === "published"
      )
      .slice(0, HIGHLIGHT_LIMIT)
      .map(toCard);
  } catch {
    return [];
  }
}

/**
 * Fetch the three cheap highlight lists for a game's mods. Each is an
 * independent Nexus endpoint (~10 mods); failures degrade to an empty list so
 * one bad tab doesn't sink the modal.
 */
export async function fetchNexusHighlights(
  apiKey: string,
  domain: string
): Promise<NexusHighlights> {
  const [trending, latestAdded, latestUpdated] = await Promise.all([
    fetchModList(apiKey, domain, "trending"),
    fetchModList(apiKey, domain, "latest_added"),
    fetchModList(apiKey, domain, "latest_updated"),
  ]);

  return { trending, latestAdded, latestUpdated };
}
