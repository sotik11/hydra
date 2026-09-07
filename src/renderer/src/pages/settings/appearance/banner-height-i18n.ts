import i18n from "i18next";

// Fork feature strings kept inline (like critic-scores-i18n / mods-i18n) so we
// don't touch upstream translation.json files. Unlisted languages fall back to
// English.
const en = {
  banner_height_title: "Banner height",
  banner_height_description:
    "Height, in pixels, of the game and profile banners. Applies instantly.",
  banner_height_reset: "Reset to default",
  banner_height_preview: "Preview",
};

const ru: typeof en = {
  banner_height_title: "Высота баннера",
  banner_height_description:
    "Высота баннеров игры и профиля в пикселях. Применяется сразу.",
  banner_height_reset: "Сбросить по умолчанию",
  banner_height_preview: "Предпросмотр",
};

const uk: typeof en = {
  banner_height_title: "Висота банера",
  banner_height_description:
    "Висота банерів гри та профілю в пікселях. Застосовується одразу.",
  banner_height_reset: "Скинути до типового",
  banner_height_preview: "Попередній перегляд",
};

const bundles: Record<string, typeof en> = { en, ru, uk };

function registerBundles() {
  for (const [lng, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(lng, "banner_height", resources, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
