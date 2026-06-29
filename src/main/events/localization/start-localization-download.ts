import { registerEvent } from "../register-event";
import { LocalizationDownloadManager } from "@main/services/localization/localization-download-manager";

const startLocalizationDownload = (
  _event: Electron.IpcMainInvokeEvent,
  studio: string,
  url: string,
  savePath: string,
  autoExtract: boolean,
  deleteArchive: boolean
) => {
  LocalizationDownloadManager.start({
    studio,
    url,
    savePath,
    autoExtract,
    deleteArchive,
  });
};

registerEvent("startLocalizationDownload", startLocalizationDownload);
