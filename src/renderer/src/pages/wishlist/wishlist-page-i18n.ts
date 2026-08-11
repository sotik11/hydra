import i18n from "i18next";

// Fork feature strings: sidebar entry (sidebar ns) + wishlist screen (wishlist
// ns), registered inline so we don't touch upstream translation.json.
const sidebar: Record<string, Record<string, string>> = {
  en: { wishlist: "Wishlist" },
  ru: { wishlist: "Список желаемого" },
  uk: { wishlist: "Список бажаного" },
};

const wishlist: Record<string, Record<string, string>> = {
  en: {
    page_title: "Wishlist",
    empty_title: "Your wishlist is empty",
    empty_hint:
      "Import your Steam wishlist in Settings → Integrations, or add games from the Catalogue with ⭐.",
    count_games: "{{count}} games",
    filters_hint: "Use the sidebar to refine the list",
    clear: "Clear",
    clear_cancel: "Cancel",
    clear_confirm_title: "Clear the wishlist?",
    clear_confirm_description:
      "All games will be removed from the list. Steam-imported games won't come back automatically.",
    sort_priority: "Wishlist priority",
    sort_added: "Recently added",
    sort_title: "Title (A-Z)",
    sort_by: "Sort by",
    filter_with_repack: "Only with a repack",
    refresh: "Refresh",
    add_to_wishlist: "Add to wishlist",
    add_to_library: "Add to library",
    remove_from_wishlist: "Remove from wishlist",
    add_to_favorites: "Add to favorites",
    remove_from_favorites: "Remove from favorites",
  },
  ru: {
    page_title: "Список желаемого",
    empty_title: "Список желаемого пуст",
    empty_hint:
      "Импортируй вишлист Steam в Настройках → Интеграции или добавь игры из Каталога через ⭐.",
    count_games: "{{count}} игр",
    filters_hint: "Используйте боковую панель для уточнения списка",
    clear: "Очистить",
    clear_cancel: "Отмена",
    clear_confirm_title: "Очистить список желаемого?",
    clear_confirm_description:
      "Все игры будут убраны из списка. Импортированные из Steam автоматически не вернутся.",
    sort_priority: "По приоритету",
    sort_added: "Недавно добавленные",
    sort_title: "По названию (A-Z)",
    sort_by: "Сортировать по",
    filter_with_repack: "Только с репаком",
    refresh: "Обновить",
    add_to_wishlist: "В список желаемого",
    add_to_library: "В библиотеку",
    remove_from_wishlist: "Убрать из списка",
    add_to_favorites: "В избранное",
    remove_from_favorites: "Убрать из избранного",
  },
  uk: {
    page_title: "Список бажаного",
    empty_title: "Список бажаного порожній",
    empty_hint:
      "Імпортуй список Steam у Налаштуваннях → Інтеграції або додай ігри з Каталогу через ⭐.",
    count_games: "{{count}} ігор",
    filters_hint: "Використовуйте бічну панель для уточнення списку",
    clear: "Очистити",
    clear_cancel: "Скасувати",
    clear_confirm_title: "Очистити список бажаного?",
    clear_confirm_description:
      "Усі ігри буде прибрано зі списку. Імпортовані зі Steam автоматично не повернуться.",
    sort_priority: "За пріоритетом",
    sort_added: "Нещодавно додані",
    sort_title: "За назвою (A-Z)",
    sort_by: "Сортувати за",
    filter_with_repack: "Лише з репаком",
    refresh: "Оновити",
    add_to_wishlist: "До списку бажаного",
    add_to_library: "До бібліотеки",
    remove_from_wishlist: "Прибрати зі списку",
    add_to_favorites: "До обраного",
    remove_from_favorites: "Прибрати з обраного",
  },
};

function registerBundles() {
  for (const [lng, res] of Object.entries(sidebar)) {
    i18n.addResourceBundle(lng, "sidebar", res, true, true);
    // Header shows the page title by route (pathTitle map) from the header ns.
    i18n.addResourceBundle(lng, "header", res, true, true);
  }
  for (const [lng, res] of Object.entries(wishlist)) {
    i18n.addResourceBundle(lng, "wishlist", res, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
