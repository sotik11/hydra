import { registerEvent } from "../register-event";
import { addManualWishlistGame } from "@main/services/steam-wishlist";

const addWishlistGame = async (
  _event: Electron.IpcMainInvokeEvent,
  appId: string
): Promise<void> => {
  await addManualWishlistGame(appId);
};

registerEvent("addWishlistGame", addWishlistGame);
