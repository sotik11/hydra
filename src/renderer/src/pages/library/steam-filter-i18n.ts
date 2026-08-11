import i18n from "i18next";

// Fork feature strings added to the existing "library" namespace without
// touching upstream translation.json (category + sort option for Steam imports).
const en = {
  category_steam: "Steam",
  sort_steam_import: "Steam imports",
};

const ru: typeof en = {
  category_steam: "Steam",
  sort_steam_import: "Импортированные из Steam",
};

const uk: typeof en = {
  category_steam: "Steam",
  sort_steam_import: "Імпортовані зі Steam",
};

const bundles: Record<string, typeof en> = { en, ru, uk };

function registerBundles() {
  for (const [lng, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(lng, "library", resources, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
