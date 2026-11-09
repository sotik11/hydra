import { releaseCalendarSublevel } from "@main/level";
import { getWishlistGames } from "@main/services/steam-wishlist/wishlist-games";
import type {
  ReleaseCalendarData,
  ReleaseCalendarPersonalStatus,
  WishlistGame,
} from "@types";
import {
  mergeReleaseCalendar,
  steamLanguageFor,
  type SteamPersonalCalendarEntry,
} from "./release-calendar-core";
import type { ReleaseCalendarCache } from "./release-calendar-cache";
import { releaseCalendarLogger } from "./release-calendar-logger";
import {
  fetchPopularUpcomingAppIds,
  fetchSteamPersonalCalendar,
  fetchSteamStoreItems,
  readSteamStoreCountry,
} from "./steam-release-sources";

const CACHE_KEY = "current";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let inflight: Promise<ReleaseCalendarData> | null = null;

const readCache = async (): Promise<ReleaseCalendarCache | null> => {
  try {
    return (await releaseCalendarSublevel.get(CACHE_KEY)) ?? null;
  } catch {
    return null;
  }
};

const wishlistFlags = (games: WishlistGame[]) =>
  new Map(
    games.map((game) => [
      game.appId,
      { isAvailable: game.reminderState === "available" },
    ])
  );

// Wishlist flags change without a rebuild (star added/removed, repack found):
// re-apply them to cached games on every read.
const applyWishlistFlags = (
  data: ReleaseCalendarData,
  wishlist: Map<string, { isAvailable: boolean }>,
  personal: SteamPersonalCalendarEntry[] | null
): ReleaseCalendarData => {
  const steamWishlisted = new Set(
    (personal ?? []).filter((entry) => entry.isWishlisted).map((e) => e.appId)
  );
  return {
    ...data,
    games: data.games.map((game) => {
      const entry = wishlist.get(game.appId);
      return {
        ...game,
        isWishlisted: Boolean(entry) || steamWishlisted.has(game.appId),
        isAvailable: entry?.isAvailable === true,
      };
    }),
  };
};

const buildReleaseCalendar = async (
  language: string,
  previous: ReleaseCalendarCache | null
): Promise<ReleaseCalendarData> => {
  const startedAt = Date.now();
  const steamLanguage = steamLanguageFor(language);
  const wishlistGames = await getWishlistGames();
  const wishlist = wishlistFlags(wishlistGames);
  const country = await readSteamStoreCountry();

  const [personalResult, popularResult] = await Promise.allSettled([
    fetchSteamPersonalCalendar(),
    fetchPopularUpcomingAppIds(country, steamLanguage),
  ]);

  let personal: SteamPersonalCalendarEntry[] | null = null;
  let personalFetchedAt = previous?.personalFetchedAt ?? null;
  let personalStatus: ReleaseCalendarPersonalStatus = "unavailable";

  if (personalResult.status === "fulfilled" && personalResult.value) {
    personal = personalResult.value;
    personalFetchedAt = Date.now();
    personalStatus = "ok";
  } else {
    if (personalResult.status === "rejected") {
      releaseCalendarLogger.error(
        "Steam personal calendar failed",
        personalResult.reason
      );
    }
    if (previous?.personal) {
      personal = previous.personal;
      personalStatus = "cached";
    }
  }

  let popularIds: string[] = [];
  if (popularResult.status === "fulfilled") {
    popularIds = popularResult.value;
  } else {
    releaseCalendarLogger.error(
      "Popular upcoming releases failed",
      popularResult.reason
    );
  }

  const appIds = [
    ...new Set([
      ...(personal ?? []).map((entry) => entry.appId),
      ...popularIds,
      ...wishlist.keys(),
    ]),
  ];
  const items = await fetchSteamStoreItems(appIds, country, steamLanguage);

  const games = mergeReleaseCalendar({
    items,
    personal: personal ?? [],
    popularIds,
    wishlist,
    now: Math.floor(Date.now() / 1000),
  });

  const data: ReleaseCalendarData = {
    games,
    personalStatus,
    fetchedAt: Date.now(),
  };

  releaseCalendarLogger.log(
    `Built: ${games.length} games from ${appIds.length} apps ` +
      `(personal ${personal?.length ?? 0} [${personalStatus}], popular ${popularIds.length}, ` +
      `wishlist ${wishlist.size}, store items ${items.size}, country ${country}) ` +
      `in ${Date.now() - startedAt} ms`
  );

  // A complete failure (no store items at all) must not wipe a good cache.
  if (items.size === 0 && previous?.data.games.length) {
    releaseCalendarLogger.error(
      "No store items came back, keeping the previous calendar"
    );
    return previous.data;
  }

  await releaseCalendarSublevel.put(CACHE_KEY, {
    data,
    language,
    wishlistAppIds: [...wishlist.keys()],
    personal,
    personalFetchedAt,
  });

  return data;
};

/**
 * Returns the merged release calendar. Served from cache while it is fresh,
 * in the same language and built with every current wishlist game; otherwise
 * rebuilt (one build at a time).
 */
export const getReleaseCalendar = async (
  forceRefresh: boolean,
  language: string
): Promise<ReleaseCalendarData> => {
  const cache = await readCache();
  const wishlistGames = await getWishlistGames();
  const wishlist = wishlistFlags(wishlistGames);

  const cachedWishlist = new Set(cache?.wishlistAppIds ?? []);
  const hasNewWishlistGames = [...wishlist.keys()].some(
    (appId) => !cachedWishlist.has(appId)
  );
  const isFresh =
    cache &&
    cache.language === language &&
    Date.now() - cache.data.fetchedAt < CACHE_TTL_MS &&
    !hasNewWishlistGames;

  if (!forceRefresh && isFresh) {
    return applyWishlistFlags(cache.data, wishlist, cache.personal);
  }

  if (!inflight) {
    releaseCalendarLogger.log(
      `Rebuilding (force=${forceRefresh}, cache=${cache ? "stale" : "none"}, newWishlist=${hasNewWishlistGames})`
    );
    inflight = buildReleaseCalendar(language, cache).finally(() => {
      inflight = null;
    });
  }

  try {
    const data = await inflight;
    return applyWishlistFlags(
      data,
      wishlist,
      (await readCache())?.personal ?? null
    );
  } catch (error) {
    releaseCalendarLogger.error("Release calendar build failed", error);
    if (cache) return applyWishlistFlags(cache.data, wishlist, cache.personal);
    throw error;
  }
};
