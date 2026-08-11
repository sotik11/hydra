import axios from "axios";

import type { SteamProfile, SteamWishlistItem } from "@types";

// SteamID64 of the first-ever account; account-id offsets are added on top.
const STEAM64_BASE = 76561197960265728n;

/**
 * Convert any concrete SteamID notation to a 17-digit SteamID64. Returns null
 * for a vanity name (/id/<name> or bare handle), which must be XML-resolved.
 * Supported: id64, /profiles/<id64> URL, STEAM_X:Y:Z, [U:1:W], steam:<hex>.
 */
export function toSteamId64(input: string): string | null {
  const value = input.trim().replace(/\/+$/, "");

  if (/^\d{17}$/.test(value)) return value;

  let match = value.match(/steamcommunity\.com\/profiles\/(\d{17})/);
  if (match) return match[1];

  match = value.match(/^STEAM_[0-5]:([01]):(\d+)$/i);
  if (match) {
    return (BigInt(match[2]) * 2n + BigInt(match[1]) + STEAM64_BASE).toString();
  }

  match = value.match(/^\[U:1:(\d+)\]$/i);
  if (match) return (BigInt(match[1]) + STEAM64_BASE).toString();

  match = value.match(/^steam:([0-9a-f]+)$/i);
  if (match) return BigInt("0x" + match[1]).toString();

  return null;
}

function pickXmlTag(xml: string, tag: string): string | null {
  // Values may be wrapped in CDATA (persona, avatar) or bare (steamID64).
  const match = xml.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([^\\]<]*)`));
  return match ? match[1] : null;
}

async function fetchProfileXml(url: string): Promise<string> {
  // steamcommunity.com aggressively rate-limits the XML endpoint (429). Retry
  // a few times with backoff before giving up.
  const maxTries = 3;
  for (let attempt = 1; attempt <= maxTries; attempt += 1) {
    try {
      const { data } = await axios.get<string>(url, {
        responseType: "text",
        timeout: 15000,
      });
      return data;
    } catch (err) {
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      if (status === 429 && attempt < maxTries) {
        await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
        continue;
      }
      throw err;
    }
  }
  throw new Error("steam-wishlist/profile-fetch-failed");
}

function profileFromXml(xml: string, steamId64: string): SteamProfile {
  return {
    steamId64,
    personaName: pickXmlTag(xml, "steamID") ?? steamId64,
    avatarUrl: pickXmlTag(xml, "avatarFull") ?? "",
  };
}

/**
 * Resolve any supported profile input to a SteamProfile (id64 + persona +
 * avatar) via the public community XML endpoint. No API key required; the
 * profile must be public. When the id64 is already known offline (id64 URL,
 * legacy/SteamID3/hex), the profile page only adds persona + avatar, so a
 * rate-limit (429) there degrades gracefully instead of failing the connect.
 */
export async function resolveSteamProfile(
  input: string
): Promise<SteamProfile> {
  const value = input.trim().replace(/\/+$/, "");
  const directId = toSteamId64(value);

  if (directId) {
    try {
      const xml = await fetchProfileXml(
        `https://steamcommunity.com/profiles/${directId}?xml=1`
      );
      return profileFromXml(xml, directId);
    } catch {
      // Profile page unavailable (e.g. 429) — keep the id64, drop the cosmetics.
      return { steamId64: directId, personaName: directId, avatarUrl: "" };
    }
  }

  // Vanity handle — the XML is the only way to resolve the id64, so it must
  // succeed here.
  const vanityUrl = /steamcommunity\.com\/id\//.test(value)
    ? `${value}?xml=1`
    : `https://steamcommunity.com/id/${encodeURIComponent(value)}?xml=1`;
  const xml = await fetchProfileXml(vanityUrl);
  const steamId64 = pickXmlTag(xml, "steamID64");

  if (!steamId64) {
    throw new Error("steam-wishlist/invalid-profile");
  }

  return profileFromXml(xml, steamId64);
}

interface GetWishlistResponse {
  response?: {
    items?: { appid: number; priority: number; date_added: number }[];
  };
}

/**
 * Pull a public wishlist via IWishlistService/GetWishlist. No API key required;
 * the account's game details must be public. Returns items sorted by the user's
 * own wishlist priority (0 = highest).
 */
export async function fetchSteamWishlist(
  steamId64: string
): Promise<SteamWishlistItem[]> {
  const { data } = await axios.get<GetWishlistResponse>(
    `https://api.steampowered.com/IWishlistService/GetWishlist/v1/?steamid=${steamId64}`
  );

  const items = data.response?.items ?? [];

  return items
    .map((item) => ({
      appId: String(item.appid),
      priority: item.priority ?? 0,
      dateAdded: item.date_added ?? 0,
    }))
    .sort((a, b) => a.priority - b.priority || b.dateAdded - a.dateAdded);
}
