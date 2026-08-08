import { registerEvent } from "../register-event";
import { LocalizationService } from "@main/services/localization";

const getLocalizationSourceGames = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string
) => {
  return LocalizationService.getSourceGames(id);
};

registerEvent("getLocalizationSourceGames", getLocalizationSourceGames);
