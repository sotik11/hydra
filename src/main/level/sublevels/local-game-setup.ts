import { db } from "../level";
import { levelKeys } from "./keys";

// Fork: per-game setup that only makes sense on this machine (where the game is
// installed, how it is launched). Upstream wipes it with the library on
// sign-out and the server never stores it, so it is remembered here and put
// back after the next sign-in. Keyed like the games sublevel (shop:objectId).
export interface LocalGameSetup {
  executablePath?: string | null;
  launchOptions?: string | null;
  winePrefixPath?: string | null;
  protonPath?: string | null;
  autoRunMangohud?: boolean | null;
  autoRunGamemode?: boolean | null;
  automaticCloudSync?: boolean;
  installedSizeInBytes?: number | null;
}

export const localGameSetupSublevel = db.sublevel<string, LocalGameSetup>(
  levelKeys.localGameSetup,
  {
    valueEncoding: "json",
  }
);
