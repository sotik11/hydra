import { registerEvent } from "../register-event";
import {
  validateNexusKey,
  matchLibraryToNexus,
} from "@main/services/nexus-mods";
import { logger } from "@main/services";
import type { NexusModsState } from "@types";

// Validate a personal Nexus API key, then match the library against the Nexus
// catalogue. The renderer persists the profile fields, the key and the matched
// count to user preferences (mirrors the Steam wishlist connect). A bad key
// throws before any matching runs → the renderer shows an error toast.
const connectNexusMods = async (
  _event: Electron.IpcMainInvokeEvent,
  apiKey: string
): Promise<NexusModsState> => {
  const profile = await validateNexusKey(apiKey);

  let matchedCount: number | null = null;
  try {
    matchedCount = await matchLibraryToNexus(apiKey, Date.now());
  } catch (err) {
    // Matching is best-effort — a catalogue hiccup must not fail the connect.
    logger.error("[nexus-mods] library match failed", err);
  }

  logger.info("[nexus-mods] connected", {
    userId: profile.userId,
    isPremium: profile.isPremium,
    matchedCount,
  });

  return {
    connected: true,
    profile,
    connectedAt: Date.now(),
    matchedCount,
  };
};

registerEvent("connectNexusMods", connectNexusMods);
