import { registerEvent } from "../register-event";
import { checkWishlistReminders } from "@main/services/steam-wishlist";

const refreshWishlistRemindersEvent = async (): Promise<void> => {
  await checkWishlistReminders();
};

registerEvent("refreshWishlistReminders", refreshWishlistRemindersEvent);
