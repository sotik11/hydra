import { registerEvent } from "../register-event";
import { db, levelKeys } from "@main/level";
import { getNexusMatchCount } from "@main/services/nexus-mods";
import type { NexusModsState, UserPreferences } from "@types";

// Rebuild the Nexus connection state from user preferences (profile fields + key
// presence live there); the matched count comes from the stored match map.
const getNexusMods = async (): Promise<NexusModsState> => {
  const userPreferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const userId = userPreferences?.nexusUserId;

  if (!userId || !userPreferences?.nexusApiKey) {
    return {
      connected: false,
      profile: null,
      connectedAt: null,
      matchedCount: null,
    };
  }

  return {
    connected: true,
    profile: {
      userId,
      name: userPreferences?.nexusUserName ?? String(userId),
      avatarUrl: userPreferences?.nexusAvatarUrl ?? "",
      isPremium: Boolean(userPreferences?.nexusIsPremium),
    },
    connectedAt: userPreferences?.nexusConnectedAt ?? null,
    matchedCount: await getNexusMatchCount(),
  };
};

registerEvent("getNexusMods", getNexusMods);
