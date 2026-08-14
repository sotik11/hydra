import axios from "axios";

import { app } from "electron";
import type { NexusProfile } from "@types";

export const NEXUS_API_BASE = "https://api.nexusmods.com/v1";

// Nexus asks every API client to identify itself with these headers.
export function nexusHeaders(apiKey: string) {
  return {
    apikey: apiKey,
    "Application-Name": "Hydra",
    "Application-Version": app.getVersion(),
    Accept: "application/json",
  };
}

interface ValidateResponse {
  user_id: number;
  name: string;
  profile_url?: string;
  is_premium?: boolean;
}

/**
 * Validate a personal Nexus API key and return the account profile. Throws when
 * the key is missing/invalid (Nexus answers 401), so the connect flow surfaces
 * an error toast instead of storing a dead key.
 */
export async function validateNexusKey(apiKey: string): Promise<NexusProfile> {
  const key = apiKey.trim();
  if (!key) throw new Error("nexus-mods/empty-key");

  const { data } = await axios.get<ValidateResponse>(
    `${NEXUS_API_BASE}/users/validate.json`,
    { headers: nexusHeaders(key), timeout: 15000 }
  );

  if (!data?.user_id) {
    throw new Error("nexus-mods/invalid-key");
  }

  return {
    userId: data.user_id,
    name: data.name ?? String(data.user_id),
    avatarUrl: data.profile_url ?? "",
    isPremium: Boolean(data.is_premium),
  };
}
