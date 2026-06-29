import i18n from "i18next";

import ar from "../../../../../locales/ar/localization.json";
import be from "../../../../../locales/be/localization.json";
import bg from "../../../../../locales/bg/localization.json";
import ca from "../../../../../locales/ca/localization.json";
import cs from "../../../../../locales/cs/localization.json";
import da from "../../../../../locales/da/localization.json";
import de from "../../../../../locales/de/localization.json";
import en from "../../../../../locales/en/localization.json";
import es from "../../../../../locales/es/localization.json";
import et from "../../../../../locales/et/localization.json";
import fa from "../../../../../locales/fa/localization.json";
import fi from "../../../../../locales/fi/localization.json";
import fr from "../../../../../locales/fr/localization.json";
import hu from "../../../../../locales/hu/localization.json";
import id from "../../../../../locales/id/localization.json";
import it from "../../../../../locales/it/localization.json";
import ja from "../../../../../locales/ja/localization.json";
import kk from "../../../../../locales/kk/localization.json";
import ko from "../../../../../locales/ko/localization.json";
import lv from "../../../../../locales/lv/localization.json";
import nb from "../../../../../locales/nb/localization.json";
import nl from "../../../../../locales/nl/localization.json";
import pl from "../../../../../locales/pl/localization.json";
import ptBR from "../../../../../locales/pt-BR/localization.json";
import ptPT from "../../../../../locales/pt-PT/localization.json";
import ro from "../../../../../locales/ro/localization.json";
import ru from "../../../../../locales/ru/localization.json";
import sl from "../../../../../locales/sl/localization.json";
import sv from "../../../../../locales/sv/localization.json";
import tr from "../../../../../locales/tr/localization.json";
import uk from "../../../../../locales/uk/localization.json";
import uz from "../../../../../locales/uz/localization.json";
import zh from "../../../../../locales/zh/localization.json";

// registers our own `localization` i18n namespace at runtime so the feature follows
// Hydra's language — upstream's i18n config stays untouched, our strings live separately
const bundles: Record<string, Record<string, string>> = {
  ar,
  be,
  bg,
  ca,
  cs,
  da,
  de,
  en,
  es,
  et,
  fa,
  fi,
  fr,
  hu,
  id,
  it,
  ja,
  kk,
  ko,
  lv,
  nb,
  nl,
  pl,
  "pt-BR": ptBR,
  "pt-PT": ptPT,
  ro,
  ru,
  sl,
  sv,
  tr,
  uk,
  uz,
  zh,
};

function registerBundles() {
  for (const [lng, resources] of Object.entries(bundles)) {
    i18n.addResourceBundle(lng, "localization", resources, true, true);
  }
}

// this can load before i18next is initialized — registering then crashes the renderer,
// so register now if ready, otherwise wait for the init event
if (i18n.isInitialized) {
  registerBundles();
} else {
  i18n.on("initialized", registerBundles);
}
