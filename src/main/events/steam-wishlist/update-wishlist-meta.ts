import { registerEvent } from "../register-event";
import { updateWishlistGameMeta } from "@main/services/steam-wishlist";
import type { WishlistGameMetaCache } from "@types";

const updateWishlistMetaEvent = async (
  _event: Electron.IpcMainInvokeEvent,
  appId: string,
  meta: WishlistGameMetaCache
): Promise<void> => {
  return updateWishlistGameMeta(appId, meta);
};

registerEvent("updateWishlistMeta", updateWishlistMetaEvent);
