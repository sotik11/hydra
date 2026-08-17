import { registerEvent } from "../register-event";
import { cancelScheduledShutdown } from "@main/services/download/shutdown-on-complete";

const cancelDownloadShutdown = (): void => {
  cancelScheduledShutdown();
};

registerEvent("cancelDownloadShutdown", cancelDownloadShutdown);
