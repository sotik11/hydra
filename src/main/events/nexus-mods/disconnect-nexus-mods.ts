import { registerEvent } from "../register-event";

// The connection state lives entirely in user preferences, which the renderer
// clears on disconnect. Nothing to tear down here yet (no item store); the
// handler exists for symmetry and future cleanup (matched-games cache).
const disconnectNexusMods = async (): Promise<void> => {
  // no-op
};

registerEvent("disconnectNexusMods", disconnectNexusMods);
