// Fork feature: release calendar. Merges three sources — Steam's personal
// calendar (through the connected Steam session), Steam's popular upcoming
// releases (public) and the fork's local wishlist — into one list of dated
// releases for the profile mini-block and the calendar page.

// How exact a release date is. Only "day" dates go into calendar cells; the rest
// ("Q1 2027", "March 2027", "2027") are shown in a separate strip.
export type ReleaseDatePrecision = "day" | "month" | "quarter" | "year";

export interface ReleaseCalendarGame {
  appId: string;
  title: string;
  // Vertical library capsule (600x900); falls back to the store header image.
  cover: string | null;
  // Unix seconds. For imprecise dates it is the approximate date Steam reports.
  releaseDate: number;
  precision: ReleaseDatePrecision;
  isEarlyAccess: boolean;
  isWishlisted: boolean;
  isOwned: boolean;
  // A wishlist game whose repack appeared (wishlist reminder state "available").
  isAvailable: boolean;
  // Present in the user's Steam personal calendar.
  isPersonal: boolean;
  // Present in Steam's popular upcoming list.
  isPopular: boolean;
  // Higher = more relevant to the user; used to order games inside a day.
  weight: number;
}

// "ok" — the personal calendar was fetched now; "cached" — Steam session is not
// available, the last saved personal list is used; "unavailable" — no session
// and nothing saved, only popular releases and the wishlist are shown.
export type ReleaseCalendarPersonalStatus = "ok" | "cached" | "unavailable";

export interface ReleaseCalendarData {
  games: ReleaseCalendarGame[];
  personalStatus: ReleaseCalendarPersonalStatus;
  fetchedAt: number;
}
