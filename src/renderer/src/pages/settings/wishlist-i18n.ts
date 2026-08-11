import i18n from "i18next";

// Fork feature strings kept inline (like localization-i18n) so we don't touch
// upstream translation.json files. Unlisted languages fall back to English.
const en = {
  wishlist_title: "Steam Wishlist",
  wishlist_loading: "Loading…",
  wishlist_description:
    "Import your public Steam wishlist and see which games already have repacks available.",
  wishlist_privacy_note: "Your Steam profile and game details must be public.",
  wishlist_profile_label: "SteamID or profile link",
  wishlist_profile_placeholder: "76561198… / steamcommunity.com/id/…",
  wishlist_connect: "Connect",
  wishlist_connected: "Steam wishlist connected",
  wishlist_connect_error:
    "Couldn't load the wishlist. Check the SteamID and that the profile is public.",
  wishlist_disconnect: "Disconnect",
  wishlist_disconnected: "Steam wishlist disconnected",
  wishlist_update: "Refresh",
  wishlist_updated: "Wishlist updated",
  wishlist_status_connected: "Connected · {{count}} games",
  wishlist_profile_hint: "Used to import your wishlist",
  wishlist_open_profile: "Open profile",
  wishlist_expand: "Expand Steam wishlist section",
  wishlist_collapse: "Collapse Steam wishlist section",
};

const ru: typeof en = {
  wishlist_title: "Список желаемого Steam",
  wishlist_loading: "Загрузка…",
  wishlist_description:
    "Импортируй свой публичный вишлист Steam и смотри, для каких игр уже есть репаки.",
  wishlist_privacy_note:
    "Профиль Steam и игровые данные должны быть публичными.",
  wishlist_profile_label: "SteamID или ссылка на профиль",
  wishlist_profile_placeholder: "76561198… / steamcommunity.com/id/…",
  wishlist_connect: "Подключить",
  wishlist_connected: "Список желаемого подключён",
  wishlist_connect_error:
    "Не удалось загрузить вишлист. Проверь SteamID и публичность профиля.",
  wishlist_disconnect: "Отключить",
  wishlist_disconnected: "Список желаемого отключён",
  wishlist_update: "Обновить",
  wishlist_updated: "Вишлист обновлён",
  wishlist_status_connected: "Подключено · {{count}} игр",
  wishlist_profile_hint: "Нужен для импорта вишлиста",
  wishlist_open_profile: "Открыть профиль",
  wishlist_expand: "Развернуть раздел списка желаемого",
  wishlist_collapse: "Свернуть раздел списка желаемого",
};

const uk: typeof en = {
  wishlist_title: "Список бажаного Steam",
  wishlist_loading: "Завантаження…",
  wishlist_description:
    "Імпортуй свій публічний список бажаного Steam і дивись, для яких ігор вже є репаки.",
  wishlist_privacy_note: "Профіль Steam та ігрові дані мають бути публічними.",
  wishlist_profile_label: "SteamID або посилання на профіль",
  wishlist_profile_placeholder: "76561198… / steamcommunity.com/id/…",
  wishlist_connect: "Підключити",
  wishlist_connected: "Список бажаного підключено",
  wishlist_connect_error:
    "Не вдалося завантажити список. Перевір SteamID і публічність профілю.",
  wishlist_disconnect: "Відключити",
  wishlist_disconnected: "Список бажаного відключено",
  wishlist_update: "Оновити",
  wishlist_updated: "Список оновлено",
  wishlist_status_connected: "Підключено · {{count}} ігор",
  wishlist_profile_hint: "Потрібен для імпорту списку",
  wishlist_open_profile: "Відкрити профіль",
  wishlist_expand: "Розгорнути розділ списку бажаного",
  wishlist_collapse: "Згорнути розділ списку бажаного",
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
