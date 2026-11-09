import i18n from "i18next";

// Fork feature strings: release calendar page + profile mini-block, registered
// inline so we don't touch upstream translation.json.
const header: Record<string, Record<string, string>> = {
  en: { release_calendar: "Release calendar" },
  ru: { release_calendar: "Календарь релизов" },
  uk: { release_calendar: "Календар релізів" },
};

const releaseCalendar: Record<string, Record<string, string>> = {
  en: {
    title: "Release calendar",
    box_title: "Releases",
    box_popular_hint: "No upcoming releases in your wishlist — popular ones",
    open_calendar: "Open calendar",
    view_grid: "Month view",
    view_list: "List view",
    filter_all: "All releases",
    filter_wishlist: "My wishlist",
    today: "Today",
    previous_month: "Previous month",
    next_month: "Next month",
    refresh: "Refresh",
    loading: "Loading releases…",
    load_failed: "Couldn't load the calendar",
    retry: "Retry",
    empty_month: "No releases this month",
    empty_upcoming: "No upcoming releases",
    imprecise_title: "No exact date yet",
    more: "+{{count}}",
    games_count: "{{count}} games",
    marker_wishlist: "In your wishlist",
    marker_available: "Available to download",
    marker_owned: "Owned on Steam",
    marker_early_access: "Early Access",
    status_cached:
      "Steam session is unavailable — showing the last saved personal calendar.",
    status_unavailable:
      "Steam session is unavailable — showing popular releases and your wishlist.",
    quarter: "Q{{quarter}} {{year}}",
  },
  ru: {
    title: "Календарь релизов",
    box_title: "Релизы",
    box_popular_hint: "В вишлисте нет ближайших релизов — популярные",
    open_calendar: "Открыть календарь",
    view_grid: "Месяц",
    view_list: "Список",
    filter_all: "Все релизы",
    filter_wishlist: "Мой вишлист",
    today: "Сегодня",
    previous_month: "Предыдущий месяц",
    next_month: "Следующий месяц",
    refresh: "Обновить",
    loading: "Загружаю релизы…",
    load_failed: "Не удалось загрузить календарь",
    retry: "Повторить",
    empty_month: "В этом месяце релизов нет",
    empty_upcoming: "Ближайших релизов нет",
    imprecise_title: "Без точной даты",
    more: "+{{count}}",
    games_count: "Игр: {{count}}",
    marker_wishlist: "В вишлисте",
    marker_available: "Доступна для загрузки",
    marker_owned: "Есть в Steam",
    marker_early_access: "Ранний доступ",
    status_cached:
      "Steam-сессия недоступна — показан последний сохранённый персональный календарь.",
    status_unavailable:
      "Steam-сессия недоступна — показаны популярные релизы и твой вишлист.",
    quarter: "{{quarter}} кв. {{year}}",
  },
  uk: {
    title: "Календар релізів",
    box_title: "Релізи",
    box_popular_hint: "У вішлисті немає найближчих релізів — популярні",
    open_calendar: "Відкрити календар",
    view_grid: "Місяць",
    view_list: "Список",
    filter_all: "Усі релізи",
    filter_wishlist: "Мій вішлист",
    today: "Сьогодні",
    previous_month: "Попередній місяць",
    next_month: "Наступний місяць",
    refresh: "Оновити",
    loading: "Завантажую релізи…",
    load_failed: "Не вдалося завантажити календар",
    retry: "Повторити",
    empty_month: "Цього місяця релізів немає",
    empty_upcoming: "Найближчих релізів немає",
    imprecise_title: "Без точної дати",
    more: "+{{count}}",
    games_count: "Ігор: {{count}}",
    marker_wishlist: "У вішлисті",
    marker_available: "Доступна для завантаження",
    marker_owned: "Є в Steam",
    marker_early_access: "Ранній доступ",
    status_cached:
      "Steam-сесія недоступна — показано останній збережений персональний календар.",
    status_unavailable:
      "Steam-сесія недоступна — показано популярні релізи та твій вішлист.",
    quarter: "{{quarter}} кв. {{year}}",
  },
};

function registerBundles() {
  for (const [lng, res] of Object.entries(header)) {
    // Header shows the page title by route (pathTitle map) from the header ns.
    i18n.addResourceBundle(lng, "header", res, true, true);
  }
  for (const [lng, res] of Object.entries(releaseCalendar)) {
    i18n.addResourceBundle(lng, "release_calendar", res, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
