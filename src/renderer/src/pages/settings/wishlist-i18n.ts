import i18n from "i18next";

// Fork feature strings kept inline (like localization-i18n) so we don't touch
// upstream translation.json files. Unlisted languages fall back to English.
// Used by the extra lines the fork adds to upstream's Steam integration card.
const en = {
  wishlist_status_wishlist: "Wishlist connected · {{count}} games",
  wishlist_status_library:
    "Library connected · {{count}} games (added to your library)",
  wishlist_open_profile: "Open profile",
};

const ru: typeof en = {
  wishlist_status_wishlist: "Подключён список желаний · {{count}} игр",
  wishlist_status_library:
    "Подключена библиотека · {{count}} игр (добавлено в твою библиотеку)",
  wishlist_open_profile: "Открыть профиль",
};

const uk: typeof en = {
  wishlist_status_wishlist: "Підключено список бажаного · {{count}} ігор",
  wishlist_status_library:
    "Підключено бібліотеку · {{count}} ігор (додано до твоєї бібліотеки)",
  wishlist_open_profile: "Відкрити профіль",
};

const bundles: Record<string, typeof en> = { en, ru, uk };

function registerBundles() {
  for (const [lng, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(lng, "wishlist", resources, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
