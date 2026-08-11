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
  const { data } = await axios.get<string>(url, { responseType: "text" });
  return data;
}

/**
 * Resolve any supported profile input to a SteamProfile (id64 + persona +
 * avatar) via the public community XML endpoint. No API key required; the
 * profile must be public.
 */
export async function resolveSteamProfile(
  input: string
): Promise<SteamProfile> {
  const value = input.trim().replace(/\/+$/, "");
  let steamId64 = toSteamId64(value);
  let xml: string;

  if (steamId64) {
    xml = await fetchProfileXml(
      `https://steamcommunity.com/profiles/${steamId64}?xml=1`
    );
  } else {
    const vanityUrl = /steamcommunity\.com\/id\//.test(value)
      ? `${value}?xml=1`
      : `https://steamcommunity.com/id/${encodeURIComponent(value)}?xml=1`;
    xml = await fetchProfileXml(vanityUrl);
    steamId64 = pickXmlTag(xml, "steamID64");
  }

  if (!steamId64) {
    throw new Error("steam-wishlist/invalid-profile");
  }

  return {
    steamId64,
    personaName: pickXmlTag(xml, "steamID") ?? steamId64,
    avatarUrl: pickXmlTag(xml, "avatarFull") ?? "",
  };
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
