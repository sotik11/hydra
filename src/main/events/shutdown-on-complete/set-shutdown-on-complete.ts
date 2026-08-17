import { registerEvent } from "../register-event";
import { setShutdownOnComplete } from "@main/services/download/shutdown-on-complete";
import type { GameShop } from "@types";

const setShutdownOnCompleteEvent = (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  enabled: boolean
): void => {
  setShutdownOnComplete(shop, objectId, enabled);
};

registerEvent("setShutdownOnComplete", setShutdownOnCompleteEvent);
