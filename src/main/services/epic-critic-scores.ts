import { logger } from "./logger";
import {
  EPIC_STORE_PAGE_URL,
  getEpicPageSlug,
  queryEpicStorefront,
} from "./epic-store-page";
import type { ExternalCriticScores } from "@types";

// Fork "Game rating & scores" for Epic games (exclusives included): the Epic
// storefront serves OpenCritic (sku = "EPIC_<pageSlug>") and Epic's own player
// rating (by sandbox = namespace) — the same numbers its product pages show.
const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 3; // 3 days

const RATINGS_QUERY = `query($sku: String!, $namespace: String!, $withReviews: Boolean!) {
  OpenCritic @include(if: $withReviews) {
    productReviews(sku: $sku) { openCriticScore award openCriticUrl }
  }
  RatingsPolls { getProductResult(sandboxId: $namespace, locale: "en-US") { averageRating } }
}`;

interface RatingsResponse {
  data?: {
    OpenCritic?: {
      productReviews?: {
        openCriticScore?: number | null;
        award?: string | null;
        openCriticUrl?: string | null;
      } | null;
    } | null;
    RatingsPolls?: {
      getProductResult?: { averageRating?: number | null } | null;
    } | null;
  };
}

const EMPTY: ExternalCriticScores = {
  metacriticUser: null,
  openCritic: null,
  epicPlayerRating: null,
};

const cache = new Map<
  string,
  { data: ExternalCriticScores; fetchedAt: number }
>();

export async function getEpicCriticScores(
  objectId: string
): Promise<ExternalCriticScores> {
  const cached = cache.get(objectId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const [namespace] = objectId.split(":");
  if (!namespace) return EMPTY;

  try {
    const slug = await getEpicPageSlug(objectId);
    const body = await queryEpicStorefront<RatingsResponse>(RATINGS_QUERY, {
      sku: slug ? `EPIC_${slug}` : "",
      namespace,
      withReviews: !!slug,
    });

    const reviews = body.data?.OpenCritic?.productReviews;
    const average = body.data?.RatingsPolls?.getProductResult?.averageRating;
    const result: ExternalCriticScores = {
      metacriticUser: null,
      openCritic:
        typeof reviews?.openCriticScore === "number" &&
        reviews.openCriticScore > 0 &&
        reviews.openCriticUrl
          ? {
              score: Math.round(reviews.openCriticScore),
              verdict: reviews.award ?? "",
              url: reviews.openCriticUrl,
            }
          : null,
      epicPlayerRating:
        typeof average === "number" && average > 0
          ? {
              average,
              url: slug ? `${EPIC_STORE_PAGE_URL}${slug}` : "",
            }
          : null,
    };

    cache.set(objectId, { data: result, fetchedAt: Date.now() });
    return result;
  } catch (err) {
    logger.error("[critic-scores] Epic storefront ratings fetch failed", {
      objectId,
      message: (err as Error)?.message,
    });
    return EMPTY;
  }
}
