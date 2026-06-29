export const GAMESVOICE_PROVIDER_ID = "builtin:gamesvoice";

// the builtin GamesVoice (RU) studio is seeded disabled; the dist build's first-run
// locale seed turns it on when the user's Hydra language is Russian. a saved choice wins.
export const GAMESVOICE_ENABLED_BY_DEFAULT = false;
export const GAMESVOICE_LOCALE = "ru";

// dist build only — pre-seedable json sources live behind a manifest on the vetted
// `stable` feed. index.json lists `{ file, locale }`, so new sources added to the feed
// show up in installed builds without an app release. (the upstream branch ships none.)
export const DEFAULT_SOURCES_FEED_BASE =
  "https://raw.githubusercontent.com/sotik11/hydra-localization-sources/stable/data";
export const DEFAULT_SOURCES_MANIFEST_URL = `${DEFAULT_SOURCES_FEED_BASE}/index.json`;
