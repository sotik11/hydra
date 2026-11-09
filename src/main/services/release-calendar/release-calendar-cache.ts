import type { ReleaseCalendarData } from "@types";
import type { SteamPersonalCalendarEntry } from "./release-calendar-core";

export interface ReleaseCalendarCache {
  data: ReleaseCalendarData;
  language: string;
  // Wishlist app ids the cached data was built with; a new wishlist game
  // means the cache has to be rebuilt to fetch its release info.
  wishlistAppIds: string[];
  // Last successful Steam personal calendar, kept for a dead session.
  personal: SteamPersonalCalendarEntry[] | null;
  personalFetchedAt: number | null;
}
