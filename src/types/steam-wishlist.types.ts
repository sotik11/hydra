// Fork feature: Steam wishlist import. A user connects a public Steam profile;
// we resolve it to a SteamID64, pull the wishlist, and match each app against
// Hydra's repack catalogue. With an optional Web API key we also resolve the
// profile reliably (GetPlayerSummaries) and import the owned-games library.

export interface SteamProfile {
  steamId64: string;
  personaName: string;
  avatarUrl: string;
}

export interface SteamWishlistItem {
  appId: string;
  priority: number;
  dateAdded: number;
}

export interface SteamOwnedGame {
  appId: string;
  title: string;
}

export interface SteamWishlistState {
  connected: boolean;
  profile: SteamProfile | null;
  items: SteamWishlistItem[];
  syncedAt: number | null;
  hasApiKey: boolean;
  libraryCount: number | null;
}

// Working wishlist store (screen + manual adds), separate from the raw Steam
// wishlist. A game is "in the wishlist" iff it has a record here. `source`
// tracks how it got in; a Steam denylist blocks the auto-import from bringing
// back games the user removed by hand.
export type WishlistGameSource = "steam" | "manual";

// Cached static metadata for a wishlist game. The raw Steam wishlist gives us
// only appIds, so we resolve title/cover/genres/year once and store them here —
// that makes search and title-sort instant on later opens (like the library,
// which keeps titles for its games). Repack sources are deliberately NOT cached:
// they change over time and are always fetched fresh.
export interface WishlistGameMetaCache {
  title?: string;
  cover?: string | null;
  genres?: string[];
  releaseYear?: number | null;
  // Steam app type ("game" / "dlc" / "music" / "demo" / ...). Anything that
  // isn't a game (or doesn't resolve at all — delisted apps) is filtered out of
  // the wishlist screen. Cached so we don't re-fetch and re-hide it every open.
  appType?: string | null;
  metaCachedAt?: number;
}

export interface WishlistGame extends WishlistGameMetaCache {
  appId: string;
  source: WishlistGameSource;
  addedAt: number;
}
