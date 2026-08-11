import { db } from "../level";
import { levelKeys } from "./keys";
import type { WishlistGame } from "@types";

// The working wishlist: keyed by Steam appId. Presence = the game is in the
// wishlist (steam-synced or manually added). Fork feature, local only.
export const wishlistGamesSublevel = db.sublevel<string, WishlistGame>(
  levelKeys.wishlistGames,
  {
    valueEncoding: "json",
  }
);

// appIds the user removed from the wishlist by hand — the Steam auto-import must
// not bring them back. Manual re-adds bypass this. Survives disconnect.
export const wishlistDenylistSublevel = db.sublevel<string, boolean>(
  levelKeys.wishlistDenylist,
  {
    valueEncoding: "json",
  }
);
