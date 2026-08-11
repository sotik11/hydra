import { registerEvent } from "../register-event";
import { clearWishlist } from "@main/services/steam-wishlist";

const clearWishlistEvent = async (): Promise<void> => {
  await clearWishlist();
};

registerEvent("clearWishlist", clearWishlistEvent);
