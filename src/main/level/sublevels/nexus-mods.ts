import { db } from "../level";
import { levelKeys } from "./keys";

// Fork feature, local only (never synced). Holds two well-known keys:
//   "catalogue" -> NexusCatalogueCache (the trimmed /v1/games.json snapshot)
//   "matches"   -> NexusMatchMap       (library objectId -> resolved Nexus match)
// Values have different shapes, so the sublevel is typed loosely and callers
// cast on read.
export const nexusModsSublevel = db.sublevel<string, unknown>(
  levelKeys.nexusMods,
  {
    valueEncoding: "json",
  }
);

export const NEXUS_CATALOGUE_KEY = "catalogue";
export const NEXUS_MATCHES_KEY = "matches";
