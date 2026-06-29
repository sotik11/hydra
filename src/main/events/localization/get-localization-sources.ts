import { registerEvent } from "../register-event";
import { LocalizationService } from "@main/services/localization";

const getLocalizationSources = async (_event: Electron.IpcMainInvokeEvent) => {
  return LocalizationService.getSources();
};

registerEvent("getLocalizationSources", getLocalizationSources);
