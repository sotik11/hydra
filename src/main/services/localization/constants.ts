export const GAMESVOICE_PROVIDER_ID = "builtin:gamesvoice";

// dist build ships GamesVoice on (this fork's main audience is RU-speaking);
// a saved on/off choice always wins over this default.
export const GAMESVOICE_ENABLED_BY_DEFAULT = true;
export const GAMESVOICE_LOCALE = "ru";

export const DEFAULT_SOURCES_FEED_BASE =
  "https://raw.githubusercontent.com/sotik11/hydra-localization-sources/stable/data";
export const DEFAULT_SOURCES_MANIFEST_URL = `${DEFAULT_SOURCES_FEED_BASE}/index.json`;
