import { registerEvent } from "../register-event";
import { db, levelKeys, steamWishlistSublevel } from "@main/level";
import type { UserPreferences } from "@types";

// Drop the cached wishlist items. The renderer clears the profile fields from
// user preferences.
const disconnectSteamWishlist = async (): Promise<void> => {
  const userPreferences = await db
    .get<string, UserPreferences | null>(levelKeys.userPreferences, {
      valueEncoding: "json",
    })
    .catch(() => null);

  const steamId = userPreferences?.steamWishlistSteamId;

  if (steamId) {
    await steamWishlistSublevel.del(steamId).catch(() => {});
  }
};

registerEvent("disconnectSteamWishlist", disconnectSteamWishlist);
