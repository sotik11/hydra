import { registerEvent } from "../register-event";
import { LocalizationDownloadManager } from "@main/services/localization/localization-download-manager";

const cancelLocalizationDownload = () => {
  LocalizationDownloadManager.cancel();
};

registerEvent("cancelLocalizationDownload", cancelLocalizationDownload);
