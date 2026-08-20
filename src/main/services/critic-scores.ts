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
