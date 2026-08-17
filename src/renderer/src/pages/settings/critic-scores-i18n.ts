import i18n from "i18next";

// Fork feature strings kept inline (like mods-i18n / wishlist-i18n) so we don't
// touch upstream translation.json files. Unlisted languages fall back to English.
const en = {
  critic_scores_title: "Game rating & scores",
  critic_scores_description:
    "Show critic scores on each game page. Pick which sources to pull from.",
  critic_scores_source_metacritic: "Metacritic",
  critic_scores_source_opencritic: "OpenCritic",
  critic_scores_soon: "soon",
  critic_scores_expand: "Expand Game rating & scores section",
  critic_scores_collapse: "Collapse Game rating & scores section",
  // Game-page panel
  critic_scores_panel_title: "Critic scores",
  critic_scores_metacritic_link: "Read critic reviews",
};

const ru: typeof en = {
  critic_scores_title: "Игровой рейтинг и оценки",
  critic_scores_description:
    "Показывать оценки критиков на странице каждой игры. Выбери, из каких источников их брать.",
  critic_scores_source_metacritic: "Metacritic",
  critic_scores_source_opencritic: "OpenCritic",
  critic_scores_soon: "скоро",
  critic_scores_expand: "Развернуть раздел «Игровой рейтинг и оценки»",
  critic_scores_collapse: "Свернуть раздел «Игровой рейтинг и оценки»",
  critic_scores_panel_title: "Оценки критиков",
  critic_scores_metacritic_link: "Читать рецензии критиков",
};

const uk: typeof en = {
  critic_scores_title: "Ігровий рейтинг та оцінки",
  critic_scores_description:
    "Показувати оцінки критиків на сторінці кожної гри. Обери, з яких джерел їх брати.",
  critic_scores_source_metacritic: "Metacritic",
  critic_scores_source_opencritic: "OpenCritic",
  critic_scores_soon: "скоро",
  critic_scores_expand: "Розгорнути розділ «Ігровий рейтинг та оцінки»",
  critic_scores_collapse: "Згорнути розділ «Ігровий рейтинг та оцінки»",
  critic_scores_panel_title: "Оцінки критиків",
  critic_scores_metacritic_link: "Читати рецензії критиків",
};

const bundles: Record<string, typeof en> = { en, ru, uk };

function registerBundles() {
  for (const [lng, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(lng, "critic_scores", resources, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
