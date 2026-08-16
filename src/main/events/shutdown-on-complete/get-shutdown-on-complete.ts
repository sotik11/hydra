import { registerEvent } from "../register-event";
import { getShutdownOnComplete } from "@main/services/download/shutdown-on-complete";
import type { GameShop } from "@types";

const getShutdownOnCompleteEvent = (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
): boolean => {
  return getShutdownOnComplete(shop, objectId);
};

registerEvent("getShutdownOnComplete", getShutdownOnCompleteEvent);
