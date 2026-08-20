import i18n from "i18next";

// Fork strings kept inline (like mods-i18n / library-i18n) so we don't touch
// upstream translation.json. Unlisted languages fall back to English.
const en = {
  tagline_placeholder: "Add a description",
  tagline_clear: "Clear",
};

const ru: typeof en = {
  tagline_placeholder: "Добавить описание",
  tagline_clear: "Очистить",
};

const uk: typeof en = {
  tagline_placeholder: "Додати опис",
  tagline_clear: "Очистити",
};

const bundles: Record<string, typeof en> = { en, ru, uk };

function registerBundles() {
  for (const [lng, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(lng, "profile_fork", resources, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
