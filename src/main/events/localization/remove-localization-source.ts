import { registerEvent } from "../register-event";
import { LocalizationService } from "@main/services/localization";

const removeLocalizationSource = async (
  _event: Electron.IpcMainInvokeEvent,
  id: string
) => {
  return LocalizationService.removeSource(id);
};

registerEvent("removeLocalizationSource", removeLocalizationSource);
