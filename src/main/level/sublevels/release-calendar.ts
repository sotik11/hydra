import { db } from "../level";
import { levelKeys } from "./keys";
import type { ReleaseCalendarCache } from "@main/services/release-calendar/release-calendar-cache";

// Single record ("current"): the last merged release calendar plus the last
// successful Steam personal calendar, so a dead Steam session still shows it.
// Fork feature, local only.
export const releaseCalendarSublevel = db.sublevel<
  string,
  ReleaseCalendarCache
>(levelKeys.releaseCalendar, {
  valueEncoding: "json",
});
