import { registerEvent } from "../register-event";
import { removeWishlistGame } from "@main/services/steam-wishlist";

const removeWishlistGameEvent = async (
  _event: Electron.IpcMainInvokeEvent,
  appId: string
): Promise<void> => {
  await removeWishlistGame(appId);
};

registerEvent("removeWishlistGame", removeWishlistGameEvent);
