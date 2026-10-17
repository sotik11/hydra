import { registerEvent } from "../register-event";
import { getEpicStorePageUrl } from "@main/services/epic-store-page";

const getEpicStorePageUrlEvent = async (
  _event: Electron.IpcMainInvokeEvent,
  objectId: string,
  title?: string
) => getEpicStorePageUrl(objectId, title);

registerEvent("getEpicStorePageUrl", getEpicStorePageUrlEvent);
