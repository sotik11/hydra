import i18n from "i18next";

// Fork feature: "Clear library" button strings, registered inline into the
// existing "library" namespace so we don't touch upstream translation.json.
const strings: Record<string, Record<string, string>> = {
  en: {
    clear_library: "Clear",
    clear_library_title: "Clear the library?",
    clear_library_description:
      "All games will be removed from the library. Downloaded files on disk are kept, and Steam-imported games can be imported again.",
    clear_library_confirm: "Clear",
    clear_library_cancel: "Cancel",
  },
  ru: {
    clear_library: "Очистить",
    clear_library_title: "Очистить библиотеку?",
    clear_library_description:
      "Все игры будут убраны из библиотеки. Скачанные файлы на диске остаются, а импортированные из Steam можно импортировать заново.",
    clear_library_confirm: "Очистить",
    clear_library_cancel: "Отмена",
  },
  uk: {
    clear_library: "Очистити",
    clear_library_title: "Очистити бібліотеку?",
    clear_library_description:
      "Усі ігри буде прибрано з бібліотеки. Завантажені файли на диску залишаються, а імпортовані зі Steam можна імпортувати знову.",
    clear_library_confirm: "Очистити",
    clear_library_cancel: "Скасувати",
  },
};

function registerBundles() {
  for (const [lng, res] of Object.entries(strings)) {
    i18n.addResourceBundle(lng, "library", res, true, true);
  }
}

if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
