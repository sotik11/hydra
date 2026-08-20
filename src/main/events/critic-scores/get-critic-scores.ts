import { registerEvent } from "../register-event";
import { getExternalCriticScores } from "@main/services/critic-scores";
import type { ExternalCriticScores, GameShop } from "@types";

const getCriticScores = async (
  _event: Electron.IpcMainInvokeEvent,
  shop: GameShop,
  objectId: string
): Promise<ExternalCriticScores> => {
  // Augmented Steam API is keyed by Steam appid — other shops have none.
  if (shop !== "steam") return { metacriticUser: null, openCritic: null };
  return getExternalCriticScores(objectId);
};

registerEvent("getCriticScores", getCriticScores);
