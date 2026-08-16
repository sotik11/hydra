import i18n from "i18next";

// Fork strings kept inline (like wishlist-i18n / mods-i18n) so we don't touch
// upstream translation.json. Relabels the library "installed" pill from the
// stock "Ready"/"Готово" to "Installed"/"Установлено". Unlisted languages fall
// back to English.
const en = {
  installed_label: "Installed",
};

const ru: typeof en = {
  installed_label: "Установлено",
};

const uk: typeof en = {
  installed_label: "Встановлено",
};

const bundles: Record<string, typeof en> = { en, ru, uk };

function registerBundles() {
  for (const [lng, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(lng, "library_fork", resources, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
