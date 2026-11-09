// Pure parsing and merging for the release calendar (no Electron imports, so it
// can be unit-tested with the Node test runner).
import type { ReleaseCalendarGame, ReleaseDatePrecision } from "@types";

export const STEAM_ASSETS_BASE_URL =
  "https://shared.steamstatic.com/store_item_assets/";

// One entry of Steam's personal calendar (store page /personalcalendar,
// SSR loaderData → arrAppInfos).
export interface SteamPersonalCalendarEntry {
  appId: string;
  releaseDate: number;
  weight: number;
  rank: number;
  isWishlisted: boolean;
  isOwned: boolean;
  isEarlyAccess: boolean;
}

// The subset of IStoreBrowseService/GetItems we use.
export interface SteamStoreItem {
  appid?: number;
  name?: string;
  type?: number;
  visible?: boolean;
  success?: number;
  release?: {
    steam_release_date?: number;
    original_release_date?: number;
    is_coming_soon?: boolean;
    coming_soon_display?: string;
    is_early_access?: boolean;
  };
  assets?: {
    asset_url_format?: string;
    library_capsule?: string;
    header?: string;
    main_capsule?: string;
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asNumber = (value: unknown, fallback = 0) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;

/**
 * Reads the personal calendar out of the page's SSR loaderData string (the one
 * holding arrAppInfos). Returns null when the payload has no calendar (logged
 * out, page layout changed).
 */
export const parseSteamPersonalCalendar = (
  raw: string | null | undefined
): SteamPersonalCalendarEntry[] | null => {
  if (!raw) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(parsed) || !Array.isArray(parsed.arrAppInfos)) return null;

  const entries: SteamPersonalCalendarEntry[] = [];
  for (const info of parsed.arrAppInfos) {
    if (!isRecord(info)) continue;
    const appId = asNumber(info.nAppID);
    const releaseDate = asNumber(info.nReleaseDate);
    if (!appId || !releaseDate) continue;

    entries.push({
      appId: String(appId),
      releaseDate,
      weight: asNumber(info.fWeight),
      rank: asNumber(info.nRank, Number.MAX_SAFE_INTEGER),
      isWishlisted: info.bIsWishlisted === true,
      isOwned: info.bIsOwned === true,
      isEarlyAccess: info.bIsEarlyAccess === true,
    });
  }

  return entries;
};

// Steam search results HTML → app ids in list order (bundles/subs are skipped:
// their data-ds-appid holds a comma-separated list).
export const parseSteamSearchAppIds = (html: string): string[] => {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const match of html.matchAll(/data-ds-appid="(\d+)"/g)) {
    if (seen.has(match[1])) continue;
    seen.add(match[1]);
    ids.push(match[1]);
  }
  return ids;
};

export const precisionFromComingSoonDisplay = (
  display: string | undefined
): ReleaseDatePrecision => {
  switch (display) {
    case "date_month":
      return "month";
    case "date_quarter":
      return "quarter";
    case "date_year":
      return "year";
    default:
      return "day";
  }
};

export const buildSteamAssetUrl = (
  format: string | undefined,
  file: string | undefined
): string | null => {
  if (!format || !file) return null;
  return STEAM_ASSETS_BASE_URL + format.replace("${FILENAME}", file);
};

export interface MergeSources {
  items: Map<string, SteamStoreItem>;
  personal: SteamPersonalCalendarEntry[];
  popularIds: string[];
  wishlist: Map<string, { isAvailable: boolean }>;
  now: number;
}

// Games released earlier than this are dropped (wishlist holds old games too).
export const RELEASE_CALENDAR_PAST_DAYS = 60;
// …and anything dated further than this ahead.
export const RELEASE_CALENDAR_FUTURE_DAYS = 2 * 365;

const STEAM_ITEM_TYPE_GAME = 0;

/**
 * Merges the three sources into calendar games. Store items decide title,
 * cover, date and precision; sources only add flags and weight. Items Steam
 * does not return (hidden, delisted, non-games) are dropped.
 */
export const mergeReleaseCalendar = ({
  items,
  personal,
  popularIds,
  wishlist,
  now,
}: MergeSources): ReleaseCalendarGame[] => {
  const personalById = new Map(personal.map((entry) => [entry.appId, entry]));
  const popularRank = new Map(popularIds.map((id, index) => [id, index]));
  const appIds = new Set<string>([
    ...personalById.keys(),
    ...popularRank.keys(),
    ...wishlist.keys(),
  ]);

  const minDate = now - RELEASE_CALENDAR_PAST_DAYS * 86_400;
  const maxDate = now + RELEASE_CALENDAR_FUTURE_DAYS * 86_400;
  const games: ReleaseCalendarGame[] = [];

  for (const appId of appIds) {
    const item = items.get(appId);
    if (!item?.name || item.type !== STEAM_ITEM_TYPE_GAME) continue;

    const personalEntry = personalById.get(appId);
    const wishlistEntry = wishlist.get(appId);
    const release = item.release ?? {};
    const releaseDate =
      release.steam_release_date ||
      release.original_release_date ||
      personalEntry?.releaseDate ||
      0;
    if (!releaseDate || releaseDate < minDate || releaseDate > maxDate) {
      continue;
    }

    const precision = release.is_coming_soon
      ? precisionFromComingSoonDisplay(release.coming_soon_display)
      : "day";
    const assets = item.assets ?? {};
    const cover =
      buildSteamAssetUrl(assets.asset_url_format, assets.library_capsule) ??
      buildSteamAssetUrl(assets.asset_url_format, assets.header) ??
      buildSteamAssetUrl(assets.asset_url_format, assets.main_capsule);

    const popularIndex = popularRank.get(appId);
    const isWishlisted =
      Boolean(wishlistEntry) || !!personalEntry?.isWishlisted;
    const weight =
      (isWishlisted ? 1000 : 0) +
      (personalEntry ? 100 + Math.min(personalEntry.weight, 100) : 0) +
      (popularIndex !== undefined ? Math.max(0, 50 - popularIndex / 4) : 0);

    games.push({
      appId,
      title: item.name,
      cover,
      releaseDate,
      precision,
      isEarlyAccess:
        release.is_early_access === true || !!personalEntry?.isEarlyAccess,
      isWishlisted,
      isOwned: !!personalEntry?.isOwned,
      isAvailable: wishlistEntry?.isAvailable === true,
      isPersonal: Boolean(personalEntry),
      isPopular: popularIndex !== undefined,
      weight,
    });
  }

  return games.sort(
    (a, b) => a.releaseDate - b.releaseDate || b.weight - a.weight
  );
};

// i18n language → Steam store language name for GetItems titles.
export const steamLanguageFor = (language: string | undefined): string => {
  const base = (language ?? "en").toLowerCase();
  const map: Record<string, string> = {
    ru: "russian",
    uk: "ukrainian",
    de: "german",
    fr: "french",
    es: "spanish",
    it: "italian",
    pl: "polish",
    "pt-br": "brazilian",
    "pt-pt": "portuguese",
    tr: "turkish",
    zh: "schinese",
    ja: "japanese",
    ko: "koreana",
    cs: "czech",
    hu: "hungarian",
    nl: "dutch",
    sv: "swedish",
    fi: "finnish",
    da: "danish",
    nb: "norwegian",
    ro: "romanian",
    bg: "bulgarian",
    el: "greek",
    vi: "vietnamese",
    id: "indonesian",
    ar: "arabic",
  };
  return map[base] ?? map[base.split("-")[0]] ?? "english";
};
