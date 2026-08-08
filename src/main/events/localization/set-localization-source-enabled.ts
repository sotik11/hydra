import { registerEvent } from "../register-event";
import { LocalizationService } from "@main/services/localization";

const setLocalizationSourceEnabled = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string,
  enabled: boolean
) => {
  return LocalizationService.setSourceEnabled(id, enabled);
};

registerEvent("setLocalizationSourceEnabled", setLocalizationSourceEnabled);
