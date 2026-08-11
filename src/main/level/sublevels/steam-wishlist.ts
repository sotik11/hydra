import { db } from "../level";
import { levelKeys } from "./keys";
import type { SteamWishlistItem } from "@types";

// Keyed by SteamID64 -> the user's wishlist items (fork feature, local only,
// never synced to the cloud).
export const steamWishlistSublevel = db.sublevel<string, SteamWishlistItem[]>(
  levelKeys.steamWishlist,
  {
    valueEncoding: "json",
  }
);
