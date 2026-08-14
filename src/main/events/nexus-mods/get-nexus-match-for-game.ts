import { registerEvent } from "../register-event";
import { getNexusMatchForGame } from "@main/services/nexus-mods";
import type { GameShop, NexusMatch } from "@types";

// The stored Nexus match for a single game (null when it didn't match). Drives
// the "Mods" button gate on the game page.
const getNexusMatchForGameEvent = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
): Promise<NexusMatch | null> => {
  return getNexusMatchForGame(shop, objectId);
};

registerEvent("getNexusMatchForGame", getNexusMatchForGameEvent);
