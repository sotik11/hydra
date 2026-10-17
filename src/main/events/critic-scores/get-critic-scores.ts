import { registerEvent } from "../register-event";
import {
  getExternalCriticScores,
  getSteamMetacritic,
} from "@main/services/critic-scores";
import type { ExternalCriticScores, GameShop } from "@types";

const getCriticScores = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string,
  includeMetacritic?: boolean
): Promise<ExternalCriticScores> => {
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
