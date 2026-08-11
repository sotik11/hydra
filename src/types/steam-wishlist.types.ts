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
