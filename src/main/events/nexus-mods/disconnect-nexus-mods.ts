import { registerEvent } from "../register-event";
import { nexusModsSublevel } from "@main/level";

// Drop the cached catalogue and match map. The renderer clears the profile
// fields and key from user preferences.
const disconnectNexusMods = async (): Promise<void> => {
  await nexusModsSublevel.clear().catch(() => {});
};

registerEvent("disconnectNexusMods", disconnectNexusMods);
