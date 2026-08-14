import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import { validateNexusKey } from "@main/services/nexus-mods";
import type { NexusModsState, UserPreferences } from "@types";

// Re-validate the stored key to refresh the profile (name / premium status). The
// renderer persists the refreshed fields to user preferences.
const refreshNexusMods = async (): Promise<NexusModsState> => {
  const userPreferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const apiKey = userPreferences?.nexusApiKey;

  if (!apiKey) {
    return { connected: false, profile: null, connectedAt: null };
  }

  const profile = await validateNexusKey(apiKey);

  return {
    connected: true,
    profile,
    connectedAt: userPreferences?.nexusConnectedAt ?? Date.now(),
  };
};

registerEvent("refreshNexusMods", refreshNexusMods);
