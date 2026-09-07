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
  banner_alignment_label: "Banner alignment",
  avatar_alignment_label: "Avatar alignment",
  align_top: "Top",
  align_center: "Center",
  align_bottom: "Bottom",
};

const ru: typeof en = {
  banner_height_title: "Высота баннера",
  banner_height_description:
    "Высота баннеров игры и профиля в пикселях. Применяется сразу.",
  banner_height_reset: "Сбросить по умолчанию",
  banner_height_preview: "Предпросмотр",
  banner_alignment_label: "Центровка баннера",
  avatar_alignment_label: "Центровка аватара",
  align_top: "Верх",
  align_center: "Центр",
  align_bottom: "Низ",
};

const uk: typeof en = {
  banner_height_title: "Висота банера",
  banner_height_description:
    "Висота банерів гри та профілю в пікселях. Застосовується одразу.",
  banner_height_reset: "Скинути до типового",
  banner_height_preview: "Попередній перегляд",
  banner_alignment_label: "Центрування банера",
  avatar_alignment_label: "Центрування аватара",
  align_top: "Верх",
  align_center: "Центр",
  align_bottom: "Низ",
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
