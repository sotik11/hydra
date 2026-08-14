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
}
