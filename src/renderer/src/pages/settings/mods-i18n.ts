import i18n from "i18next";

// Fork feature strings kept inline (like wishlist-i18n / localization-i18n) so we
// don't touch upstream translation.json files. Unlisted languages fall back to
// English.
const en = {
  mods_title: "Nexus Mods",
  mods_loading: "Loading…",
  mods_description:
    "Connect your Nexus account to see which of your games have mods and open them on Nexus.",
  mods_privacy_note:
    "Your personal API key is used only on this machine and never leaves it.",
  mods_api_key_label: "Nexus API key",
  mods_api_key_placeholder: "Personal API key",
  mods_api_key_hint: "Get your key from Nexus account settings",
  mods_connect: "Connect",
  mods_connected: "Nexus account connected",
  mods_connect_error: "Couldn't validate the key. Check your Nexus API key.",
  mods_disconnect: "Disconnect",
  mods_disconnected: "Nexus account disconnected",
  mods_update: "Refresh",
  mods_updated: "Nexus account refreshed",
  mods_status_connected: "Nexus account connected",
  mods_status_premium: "Premium account",
  mods_status_free: "Free account",
  mods_status_matched: "{{count}} games matched with mods",
  mods_open_profile: "Open profile",
  mods_expand: "Expand Nexus Mods section",
  mods_collapse: "Collapse Nexus Mods section",
  mods_button: "Mods",
  mods_modal_title: "Mods",
  mods_modal_source: "nexus mods",
  mods_modal_trending: "Trending",
  mods_modal_new: "New",
  mods_modal_updated: "Updated",
  mods_modal_all: "All mods on Nexus",
  mods_modal_loading: "Loading mods…",
  mods_modal_empty: "Nothing here yet.",
};

const ru: typeof en = {
  mods_title: "Модификации (Nexus)",
  mods_loading: "Загрузка…",
  mods_description:
    "Подключи аккаунт Nexus, чтобы видеть, для каких твоих игр есть моды, и открывать их на Nexus.",
  mods_privacy_note:
    "Твой личный API-ключ используется только на этой машине и никуда не отправляется.",
  mods_api_key_label: "Ключ Nexus API",
  mods_api_key_placeholder: "Личный API-ключ",
  mods_api_key_hint: "Получить ключ в настройках аккаунта Nexus",
  mods_connect: "Подключить",
  mods_connected: "Аккаунт Nexus подключён",
  mods_connect_error: "Не удалось проверить ключ. Проверь свой Nexus API-ключ.",
  mods_disconnect: "Отключить",
  mods_disconnected: "Аккаунт Nexus отключён",
  mods_update: "Обновить",
  mods_updated: "Аккаунт Nexus обновлён",
  mods_status_connected: "Аккаунт Nexus подключён",
  mods_status_premium: "Premium-аккаунт",
  mods_status_free: "Бесплатный аккаунт",
  mods_status_matched: "Сматчено {{count}} игр с модами",
  mods_open_profile: "Открыть профиль",
  mods_expand: "Развернуть раздел Nexus Mods",
  mods_collapse: "Свернуть раздел Nexus Mods",
  mods_button: "Модификации",
  mods_modal_title: "Модификации",
  mods_modal_source: "nexus mods",
  mods_modal_trending: "Популярные",
  mods_modal_new: "Новые",
  mods_modal_updated: "Обновлённые",
  mods_modal_all: "Все моды на Nexus",
  mods_modal_loading: "Загрузка модов…",
  mods_modal_empty: "Здесь пока пусто.",
};

const uk: typeof en = {
  mods_title: "Модифікації (Nexus)",
  mods_loading: "Завантаження…",
  mods_description:
    "Підключи акаунт Nexus, щоб бачити, для яких твоїх ігор є моди, і відкривати їх на Nexus.",
  mods_privacy_note:
    "Твій особистий API-ключ використовується лише на цій машині й нікуди не надсилається.",
  mods_api_key_label: "Ключ Nexus API",
  mods_api_key_placeholder: "Особистий API-ключ",
  mods_api_key_hint: "Отримати ключ у налаштуваннях акаунта Nexus",
  mods_connect: "Підключити",
  mods_connected: "Акаунт Nexus підключено",
  mods_connect_error:
    "Не вдалося перевірити ключ. Перевір свій Nexus API-ключ.",
  mods_disconnect: "Відключити",
  mods_disconnected: "Акаунт Nexus відключено",
  mods_update: "Оновити",
  mods_updated: "Акаунт Nexus оновлено",
  mods_status_connected: "Акаунт Nexus підключено",
  mods_status_premium: "Premium-акаунт",
  mods_status_free: "Безкоштовний акаунт",
  mods_status_matched: "Зматчено {{count}} ігор з модами",
  mods_open_profile: "Відкрити профіль",
  mods_expand: "Розгорнути розділ Nexus Mods",
  mods_collapse: "Згорнути розділ Nexus Mods",
  mods_button: "Модифікації",
  mods_modal_title: "Модифікації",
  mods_modal_source: "nexus mods",
  mods_modal_trending: "Популярні",
  mods_modal_new: "Нові",
  mods_modal_updated: "Оновлені",
  mods_modal_all: "Всі моди на Nexus",
  mods_modal_loading: "Завантаження модів…",
  mods_modal_empty: "Тут поки порожньо.",
};

const bundles: Record<string, typeof en> = { en, ru, uk };

function registerBundles() {
  for (const [lng, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(lng, "mods", resources, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
