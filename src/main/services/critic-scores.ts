import axios from "axios";
import { logger } from "./logger";
import type { ExternalCriticScores } from "@types";

// Fork "Game rating & scores" — external ratings from the Augmented Steam API,
// keyed by Steam appid. Gives the Metacritic *user* score and OpenCritic (the
// Metacritic *critic* score stays sourced from Steam appdetails).
const AUGMENTED_STEAM_APP = "https://api.augmentedsteam.com/app";
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

const EMPTY: ExternalCriticScores = { metacriticUser: null, openCritic: null };

interface CacheEntry {
  data: ExternalCriticScores;
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getExternalCriticScores(
  appId: string
): Promise<ExternalCriticScores> {
  const cached = cache.get(appId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const { data } = await axios.get(`${AUGMENTED_STEAM_APP}/${appId}/v2`, {
      timeout: 15000,
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    const reviews = data?.reviews ?? {};
    const metauser = reviews.metauser;
    const opencritic = reviews.opencritic;

    const result: ExternalCriticScores = {
      metacriticUser:
        typeof metauser?.score === "number"
          ? { score: metauser.score, url: metauser.url }
          : null,
      openCritic:
        typeof opencritic?.score === "number"
          ? {
              score: opencritic.score,
              verdict: opencritic.verdict ?? "",
              url: opencritic.url,
            }
          : null,
    };

    cache.set(appId, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    logger.error("[critic-scores] Augmented Steam fetch failed", {
      appId,
      message: (err as Error)?.message,
    });
    return EMPTY;
  }
}

// Metacritic *critic* score straight from Steam appdetails — for pages without
// Steam shop details of their own (an Epic copy of a game that is also on Steam).
const STEAM_APPDETAILS = "https://store.steampowered.com/api/appdetails";
type SteamMetacritic = NonNullable<ExternalCriticScores["metacritic"]>;
const metacriticCache = new Map<
  string,
  { data: SteamMetacritic | null; fetchedAt: number }
>();

export async function getSteamMetacritic(
  appId: string
): Promise<SteamMetacritic | null> {
  const cached = metacriticCache.get(appId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const { data } = await axios.get(STEAM_APPDETAILS, {
      params: { appids: appId, filters: "metacritic" },
      timeout: 15000,
    });
    const metacritic = data?.[appId]?.data?.metacritic;
    const result: SteamMetacritic | null =
      typeof metacritic?.score === "number" && metacritic.url
        ? { score: metacritic.score, url: metacritic.url }
        : null;
    metacriticCache.set(appId, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    logger.error("[critic-scores] Steam appdetails metacritic fetch failed", {
      appId,
      message: (err as Error)?.message,
    });
    return null;
  }
}

// Steam user reviews summary (% positive + Steam's verdict in the UI language).
const STEAM_APPREVIEWS = "https://store.steampowered.com/appreviews/";
type SteamReviews = NonNullable<ExternalCriticScores["steamReviews"]>;
const STEAM_REVIEW_LANGUAGES: Record<string, string> = {
  ru: "russian",
  uk: "ukrainian",
  de: "german",
  fr: "french",
  es: "spanish",
  it: "italian",
  pl: "polish",
  pt: "portuguese",
  tr: "turkish",
  cs: "czech",
  hu: "hungarian",
  ja: "japanese",
  ko: "koreana",
  zh: "schinese",
};
const steamReviewsCache = new Map<
  string,
  { data: SteamReviews | null; fetchedAt: number }
>();

export async function getSteamReviews(
  appId: string,
  language?: string
): Promise<SteamReviews | null> {
  const steamLanguage =
    STEAM_REVIEW_LANGUAGES[(language ?? "en").toLowerCase().split(/[-_]/)[0]] ??
    "english";
  const cacheKey = `${appId}:${steamLanguage}`;
  const cached = steamReviewsCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  try {
    const { data } = await axios.get(`${STEAM_APPREVIEWS}${appId}`, {
      params: {
        json: 1,
        language: "all",
        purchase_type: "all",
        num_per_page: 0,
        l: steamLanguage,
      },
      timeout: 15000,
    });
    const summary = data?.query_summary;
    const total = Number(summary?.total_reviews ?? 0);
    const positive = Number(summary?.total_positive ?? 0);
    const result: SteamReviews | null =
      total > 0
        ? {
            percent: Math.round((positive / total) * 100),
            total,
            description: String(summary?.review_score_desc ?? ""),
            url: `https://store.steampowered.com/app/${appId}/#app_reviews_hash`,
          }
        : null;
    steamReviewsCache.set(cacheKey, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    logger.error("[critic-scores] Steam reviews fetch failed", {
      appId,
      message: (err as Error)?.message,
    });
    return null;
  }
}
