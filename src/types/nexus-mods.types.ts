// Fork feature: Nexus Mods. A user connects their Nexus account with a personal
// API key; we validate it (/v1/users/validate.json) to get their profile, then
// (later chunks) match library games against Nexus by title and surface a
// "Mods" button that deep-links to the game's mods on nexusmods.com.

export interface NexusProfile {
  userId: number;
  name: string;
  avatarUrl: string;
  isPremium: boolean;
}

export interface NexusModsState {
  connected: boolean;
  profile: NexusProfile | null;
  connectedAt: number | null;
  // How many library games resolved to a Nexus game with mods (null = not
  // computed yet).
  matchedCount: number | null;
}

// Trimmed game record from /v1/games.json (the fields we actually use).
export interface NexusGameLite {
  id: number;
  name: string;
  domainName: string;
  mods: number;
}

export interface NexusCatalogueCache {
  fetchedAt: number;
  games: NexusGameLite[];
}

// A resolved library-game -> Nexus match. Keyed in the store by `${shop}:${objectId}`.
export interface NexusMatch {
  domain: string;
  name: string;
  mods: number;
}

export type NexusMatchMap = Record<string, NexusMatch>;
