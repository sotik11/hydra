import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import { fetchNexusHighlights } from "@main/services/nexus-mods";
import type { NexusHighlights, UserPreferences } from "@types";

const EMPTY: NexusHighlights = {
  trending: [],
  latestAdded: [],
  latestUpdated: [],
};

// Fetch the trending / latest-added / latest-updated highlight lists for a
// game's Nexus domain. Uses the stored key; returns empty lists when not
// connected.
const getNexusHighlights = async (
  _event: Electron.IpcMainInvokeEvent,
  domain: string
): Promise<NexusHighlights> => {
  if (!domain) return EMPTY;

  const userPreferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const apiKey = userPreferences?.nexusApiKey;
  if (!apiKey) return EMPTY;

  return fetchNexusHighlights(apiKey, domain);
};

registerEvent("getNexusHighlights", getNexusHighlights);
