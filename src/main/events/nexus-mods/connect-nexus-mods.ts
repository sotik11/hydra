import { registerEvent } from "../register-event";
import { validateNexusKey } from "@main/services/nexus-mods";
import { logger } from "@main/services";
import type { NexusModsState } from "@types";

// Validate a personal Nexus API key and return the account profile. The renderer
// persists the profile fields and the key to user preferences (mirrors the Steam
// wishlist connect). A bad key throws → the renderer shows an error toast.
const connectNexusMods = async (
  _event: Electron.IpcMainInvokeEvent,
  apiKey: string
): Promise<NexusModsState> => {
  const profile = await validateNexusKey(apiKey);

  logger.info("[nexus-mods] connected", {
    userId: profile.userId,
    isPremium: profile.isPremium,
  });

  return {
    connected: true,
    profile,
    connectedAt: Date.now(),
  };
};

registerEvent("connectNexusMods", connectNexusMods);
