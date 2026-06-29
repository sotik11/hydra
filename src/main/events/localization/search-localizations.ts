import { registerEvent } from "../register-event";
import { LocalizationService } from "@main/services/localization";
import type { GameShop } from "@types";

const searchLocalizations = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  title: string
) => {
  return LocalizationService.search({ shop, objectId, title });
};

registerEvent("searchLocalizations", searchLocalizations);
