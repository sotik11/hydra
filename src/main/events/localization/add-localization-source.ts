import { registerEvent } from "../register-event";
import { LocalizationService } from "@main/services/localization";

const addLocalizationSource = async (
  _event: Electron.IpcMainInvokeEvent,
  url: string
) => {
  return LocalizationService.addJsonSource(url);
};

registerEvent("addLocalizationSource", addLocalizationSource);
