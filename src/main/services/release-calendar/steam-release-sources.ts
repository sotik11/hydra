import { BrowserWindow, session } from "electron";
import {
  STEAM_SESSION_PARTITION,
  applySteamSessionUserAgent,
} from "@main/services/steam-integration/steam-store-session";
import {
  parseSteamPersonalCalendar,
  parseSteamSearchAppIds,
  type SteamPersonalCalendarEntry,
  type SteamStoreItem,
} from "./release-calendar-core";
import { releaseCalendarLogger } from "./release-calendar-logger";

const PERSONAL_CALENDAR_URL = "https://store.steampowered.com/personalcalendar";
const PERSONAL_CALENDAR_TIMEOUT_MS = 30_000;
const POPULAR_UPCOMING_PAGES = 3;
const POPULAR_UPCOMING_PAGE_SIZE = 50;
const GET_ITEMS_CHUNK = 100;
const GET_ITEMS_URL =
  "https://api.steampowered.com/IStoreBrowseService/GetItems/v1/";

const withTimeout = <T>(promise: Promise<T>, ms: number, label: string) =>
  new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

/**
 * Loads Steam's personal calendar in a hidden window of the Steam session.
 * The page keeps its SSR payload on window.SSR.loaderData; only the entry with
 * arrAppInfos is read back (the other entry holds the Web API token, it never
 * leaves the page). Returns null when the session is logged out.
 */
export const fetchSteamPersonalCalendar = async (): Promise<
  SteamPersonalCalendarEntry[] | null
> => {
  applySteamSessionUserAgent();

  const window = new BrowserWindow({
    show: false,
    width: 1200,
    height: 800,
    webPreferences: {
      partition: STEAM_SESSION_PARTITION,
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  window.webContents.setAudioMuted(true);

  try {
    await withTimeout(
      window.loadURL(PERSONAL_CALENDAR_URL),
      PERSONAL_CALENDAR_TIMEOUT_MS,
      "personal calendar load"
    );

    const finalUrl = window.webContents.getURL();
    if (/\/login\b/.test(new URL(finalUrl).pathname)) {
      releaseCalendarLogger.log("Steam personal calendar: session logged out");
      return null;
    }

    const raw = (await withTimeout(
      window.webContents.executeJavaScript(`
        (() => {
          const data = window.SSR && window.SSR.loaderData;
          if (!Array.isArray(data)) return null;
          const entry = data.find(
            (item) => typeof item === "string" && item.includes('"arrAppInfos"')
          );
          return entry ?? null;
        })()
      `),
      10_000,
      "personal calendar read"
    )) as string | null;

    const entries = parseSteamPersonalCalendar(raw);
    if (!entries) {
      releaseCalendarLogger.log(
        "Steam personal calendar: no arrAppInfos on the page (logged out or layout changed)"
      );
    }
    return entries;
  } finally {
    if (!window.isDestroyed()) window.destroy();
  }
};

// Store country from the Steam session cookie ("UA%7C…"); Steam hides some
// apps per region, so GetItems should ask for the user's own one.
export const readSteamStoreCountry = async (): Promise<string> => {
  try {
    const cookies = await session
      .fromPartition(STEAM_SESSION_PARTITION)
      .cookies.get({
        url: "https://store.steampowered.com/",
        name: "steamCountry",
      });
    const country = decodeURIComponent(cookies[0]?.value ?? "").split("|")[0];
    return /^[A-Z]{2}$/.test(country) ? country : "US";
  } catch {
    return "US";
  }
};

export const fetchPopularUpcomingAppIds = async (
  country: string,
  steamLanguage: string
): Promise<string[]> => {
  const ids: string[] = [];
  for (let page = 0; page < POPULAR_UPCOMING_PAGES; page++) {
    const url = new URL("https://store.steampowered.com/search/results/");
    url.searchParams.set("filter", "popularcomingsoon");
    url.searchParams.set("infinite", "1");
    url.searchParams.set("category1", "998");
    url.searchParams.set("json", "1");
    url.searchParams.set("start", String(page * POPULAR_UPCOMING_PAGE_SIZE));
    url.searchParams.set("count", String(POPULAR_UPCOMING_PAGE_SIZE));
    url.searchParams.set("cc", country);
    url.searchParams.set("l", steamLanguage);

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`popular upcoming http ${response.status}`);
    }
    const body = (await response.json()) as { results_html?: string };
    const pageIds = parseSteamSearchAppIds(body.results_html ?? "");
    ids.push(...pageIds);
    if (pageIds.length < POPULAR_UPCOMING_PAGE_SIZE) break;
  }
  return [...new Set(ids)];
};

export const fetchSteamStoreItems = async (
  appIds: string[],
  country: string,
  steamLanguage: string
): Promise<Map<string, SteamStoreItem>> => {
  const items = new Map<string, SteamStoreItem>();

  for (let index = 0; index < appIds.length; index += GET_ITEMS_CHUNK) {
    const chunk = appIds.slice(index, index + GET_ITEMS_CHUNK);
    const input = {
      ids: chunk.map((appid) => ({ appid: Number(appid) })),
      context: { language: steamLanguage, country_code: country },
      data_request: { include_assets: true, include_release: true },
    };
    const url = new URL(GET_ITEMS_URL);
    url.searchParams.set("input_json", JSON.stringify(input));

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`http ${response.status}`);
      const body = (await response.json()) as {
        response?: { store_items?: SteamStoreItem[] };
      };
      for (const item of body.response?.store_items ?? []) {
        if (item.appid) items.set(String(item.appid), item);
      }
    } catch (error) {
      // One failed chunk only loses its games; the rest of the calendar stays.
      releaseCalendarLogger.error(
        `GetItems chunk ${index / GET_ITEMS_CHUNK} (${chunk.length} apps) failed`,
        error
      );
    }
  }

  return items;
};
