import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import {
  validateNexusKey,
  matchLibraryToNexus,
} from "@main/services/nexus-mods";
import type { NexusModsState, UserPreferences } from "@types";

// Re-validate the stored key and re-run the library match with a forced
// catalogue refresh. The renderer persists the refreshed fields to user
// preferences.
const refreshNexusMods = async (): Promise<NexusModsState> => {
  const userPreferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const apiKey = userPreferences?.nexusApiKey;

  if (!apiKey) {
    return {
      connected: false,
      profile: null,
      connectedAt: null,
      matchedCount: null,
    };
  }

  const profile = await validateNexusKey(apiKey);
  const matchedCount = await matchLibraryToNexus(apiKey, Date.now(), true);

  return {
    connected: true,
    profile,
    connectedAt: userPreferences?.nexusConnectedAt ?? Date.now(),
    matchedCount,
  };
};

registerEvent("refreshNexusMods", refreshNexusMods);
