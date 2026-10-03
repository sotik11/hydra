import { registerEvent } from "../register-event";
import { getSteamWishlistSummary } from "@main/services/steam-wishlist";
import type { SteamWishlistSummary } from "@types";

// What is cached from the last successful Steam wishlist sync (count + time).
const getSteamWishlist = (): Promise<SteamWishlistSummary> =>
  getSteamWishlistSummary();

registerEvent("getSteamWishlist", getSteamWishlist);
