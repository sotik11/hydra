import { registerEvent } from "../register-event";
import { getReleaseCalendar } from "@main/services/release-calendar";
import type { ReleaseCalendarData } from "@types";

const getReleaseCalendarEvent = async (
  _event: Electron.IpcMainInvokeEvent,
  forceRefresh: boolean,
  language: string
): Promise<ReleaseCalendarData> => {
  return getReleaseCalendar(Boolean(forceRefresh), language || "en");
};

registerEvent("getReleaseCalendar", getReleaseCalendarEvent);
