import { getSteamWebApiToken } from "@main/services/steam-integration/steam-store-session";
import { steamWebApiGet } from "@main/services/steam-integration/steam-web-api";
import type { SteamWishlistItem } from "@types";

interface GetWishlistResponse {
  response?: {
    items?: { appid: number; priority?: number; date_added?: number }[];
  };
}

export interface SteamSessionWishlist {
  steamId64: string;
  items: SteamWishlistItem[];
}

/**
 * Pull the wishlist of the account signed in through upstream's Steam
 * integration. Uses its store session (no SteamID input, no Web API key), so it
 * only works while that session is alive — callers must treat a failure as
 * "keep what we have".
 */
export async function fetchSteamWishlistWithSession(
  signal?: AbortSignal
): Promise<SteamSessionWishlist> {
  const token = await getSteamWebApiToken(signal);

  const body = (await steamWebApiGet({
    path: "IWishlistService/GetWishlist/v1/",
    token,
    signal,
  })) as GetWishlistResponse | null;

  const items = (body?.response?.items ?? [])
    .map((item) => ({
      appId: String(item.appid),
      priority: item.priority ?? 0,
      dateAdded: item.date_added ?? 0,
    }))
    .sort((a, b) => a.priority - b.priority || b.dateAdded - a.dateAdded);

  return { steamId64: token.steamId64, items };
}
