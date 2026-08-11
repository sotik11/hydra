import { registerEvent } from "../register-event";
import { getWishlistGames } from "@main/services/steam-wishlist";
import type { WishlistGame } from "@types";

const getWishlistGamesEvent = async (): Promise<WishlistGame[]> => {
  return getWishlistGames();
};

registerEvent("getWishlistGames", getWishlistGamesEvent);
