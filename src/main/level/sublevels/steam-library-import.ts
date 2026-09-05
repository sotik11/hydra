import { db } from "../level";
import { levelKeys } from "./keys";

// Durable set of Steam appIds the user imported into their library (fork feature).
// Keyed by appId -> true. Lives in OUR sublevel so it survives Hydra's cloud
// library-sync, sign-out (which clears account games) and rebuilds — unlike the
// `steamLibraryImport` flag on the shared game record, which cloud sync overwrites.
export const steamLibraryImportAppIdsSublevel = db.sublevel<string, boolean>(
  levelKeys.steamLibraryImportAppIds,
  {
    valueEncoding: "json",
  }
);
