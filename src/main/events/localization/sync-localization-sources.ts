import { registerEvent } from "../register-event";
import { LocalizationService } from "@main/services/localization";

const syncLocalizationSources = async (_event: Electron.IpcMainInvokeEvent) => {
  return LocalizationService.syncJsonSources();
};

registerEvent("syncLocalizationSources", syncLocalizationSources);
