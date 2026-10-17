import { logger } from "./logger";

// Fork: store page URL for an Epic game (objectId = "namespace:itemId").
// The canonical slug is catalogNs.mappings(pageType: "productHome").pageSlug —
// urlSlug is sometimes a bare hash and productSlug is often null. Falls back to
// the offer's own mapping / productSlug, then to a store search by title.
// Same public storefront endpoint and client headers as upstream's
// epic-store-details.ts (plain clients get an hCaptcha redirect).
const STOREFRONT_GRAPHQL = "https://launcher.store.epicgames.com/graphql";
const STORE_PAGE = "https://store.epicgames.com/p/";
const STORE_SEARCH = "https://store.epicgames.com/browse?q=";
const REQUEST_TIMEOUT_MS = 10_000;

const SLUG_QUERY = `query($namespace: String!) {
  Catalog {
    catalogNs(namespace: $namespace) { mappings(pageType: "productHome") { pageSlug } }
    catalogOffers(namespace: $namespace, params: { count: 50 }) {
      elements { items { id } productSlug offerMappings { pageSlug pageType } }
    }
  }
}`;

interface SlugResponse {
  data?: {
    Catalog?: {
      catalogNs?: { mappings?: { pageSlug?: string | null }[] | null } | null;
      catalogOffers?: {
        elements?: {
          items?: { id: string }[] | null;
          productSlug?: string | null;
          offerMappings?:
            | { pageSlug?: string | null; pageType?: string }[]
            | null;
        }[];
      } | null;
    };
  };
}

const slugCache = new Map<string, string | null>();

const pickSlug = (body: SlugResponse, itemId: string): string | null => {
  const catalog = body.data?.Catalog;
  const pageSlug = catalog?.catalogNs?.mappings?.find(
    (mapping) => mapping.pageSlug
  )?.pageSlug;
  if (pageSlug) return pageSlug;

  const offer = catalog?.catalogOffers?.elements?.find((element) =>
    element.items?.some((item) => item.id === itemId)
  );
  const offerSlug =
    offer?.offerMappings?.find((mapping) => mapping.pageType === "productHome")
      ?.pageSlug ??
    offer?.offerMappings?.find((mapping) => mapping.pageSlug)?.pageSlug;
  if (offerSlug) return offerSlug;

  const productSlug = offer?.productSlug?.split("/")[0];
  return productSlug || null;
};

const fetchSlug = async (namespace: string, itemId: string) => {
  const response = await fetch(STOREFRONT_GRAPHQL, {
    method: "POST",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": "EpicGamesLauncher/15.0.0",
      Origin: "https://store.epicgames.com",
      Referer: "https://store.epicgames.com/",
    },
    body: JSON.stringify({ query: SLUG_QUERY, variables: { namespace } }),
  });
  if (!response.ok) throw new Error(`Epic storefront HTTP ${response.status}`);
  return pickSlug((await response.json()) as SlugResponse, itemId);
};

export const getEpicStorePageUrl = async (
  objectId: string,
  title?: string
): Promise<string | null> => {
  const [namespace, itemId] = objectId.split(":");
  const searchUrl = title?.trim()
    ? `${STORE_SEARCH}${encodeURIComponent(title.trim())}`
    : null;
  if (!namespace || !itemId) return searchUrl;

  if (!slugCache.has(objectId)) {
    try {
      slugCache.set(objectId, await fetchSlug(namespace, itemId));
    } catch (error) {
      logger.warn("[epic-store-page] slug lookup failed", {
        objectId,
        message: (error as Error)?.message,
      });
      // Not cached: a network hiccup should not stick for the session.
      return searchUrl;
    }
  }

  const slug = slugCache.get(objectId);
  return slug ? `${STORE_PAGE}${slug}` : searchUrl;
};
