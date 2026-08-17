import { registerEvent } from "../register-event";
import { nexusModsSublevel } from "@main/level";
import { clearNexusIndexMemo } from "@main/services/nexus-mods";

// Drop the cached catalogue and match map. The renderer clears the profile
// fields and key from user preferences.
const disconnectNexusMods = async (): Promise<void> => {
  await nexusModsSublevel.clear().catch(() => {});
  clearNexusIndexMemo();
};

registerEvent("disconnectNexusMods", disconnectNexusMods);
