import { registerEvent } from "../register-event";
import {
  getExternalCriticScores,
  getSteamMetacritic,
} from "@main/services/critic-scores";
import { getEpicCriticScores } from "@main/services/epic-critic-scores";
import type { ExternalCriticScores, GameShop } from "@types";

const getCriticScores = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  includeMetacritic?: boolean
): Promise<ExternalCriticScores> => {
  // Epic games (exclusives too): OpenCritic + Epic player rating from the Epic
  // storefront, by "namespace:itemId".
  if (shop === "epic") return getEpicCriticScores(objectId);
  // Augmented Steam API is keyed by Steam appid — other shops have none.
  // Epic copies of Steam games pass their linked Steam appid here.
  if (shop !== "steam") return { metacriticUser: null, openCritic: null };
  const [external, metacritic] = await Promise.all([
    getExternalCriticScores(objectId),
    includeMetacritic ? getSteamMetacritic(objectId) : Promise.resolve(null),
  ]);
  return includeMetacritic ? { ...external, metacritic } : external;
};

registerEvent("getCriticScores", getCriticScores);
