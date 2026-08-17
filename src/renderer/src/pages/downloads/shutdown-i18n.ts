import i18n from "i18next";

// Fork feature strings kept inline (like wishlist-i18n / mods-i18n) so we don't
// touch upstream translation.json files. Unlisted languages fall back to English.
const en = {
  shutdown_on_complete: "Shut down PC when finished",
  shutdown_scheduled: "Shutting down in {{seconds}}s",
  shutdown_cancel: "Cancel",
};

const ru: typeof en = {
  shutdown_on_complete: "Выключить ПК по завершении",
  shutdown_scheduled: "Выключение через {{seconds}} с",
  shutdown_cancel: "Отмена",
};

const uk: typeof en = {
  shutdown_on_complete: "Вимкнути ПК після завершення",
  shutdown_scheduled: "Вимкнення через {{seconds}} с",
  shutdown_cancel: "Скасувати",
};

const bundles: Record<string, typeof en> = { en, ru, uk };

function registerBundles() {
  for (const [lng, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(lng, "shutdown", resources, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
