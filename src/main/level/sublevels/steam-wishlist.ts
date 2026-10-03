import { db } from "../level";
import { levelKeys } from "./keys";
import type { SteamWishlistCache } from "@types";

// Single record ("current") holding the raw Steam wishlist of the account
// connected through upstream's Steam integration (fork feature, local only,
// never synced to the cloud).
export const steamWishlistSublevel = db.sublevel<string, SteamWishlistCache>(
  levelKeys.steamWishlist,
  {
    valueEncoding: "json",
  }
);
