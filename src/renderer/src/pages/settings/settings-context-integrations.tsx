import { useTranslation } from "react-i18next";
import { SettingsDebrid } from "./settings-debrid";
import { SettingsRetroAchievements } from "./settings-retroachievements";
import { SettingsWishlist } from "./settings-wishlist";
import { SettingsMods } from "./settings-mods";
import { SettingsCriticScores } from "./settings-critic-scores";
import { SettingsLocalizationSources } from "./settings-localization-sources";

export function SettingsContextIntegrations() {
  const { t } = useTranslation("settings");

  return (
    <div className="settings-context-panel">
      <div className="settings-context-panel__group">
        <SettingsRetroAchievements />
      </div>

      <hr className="settings-context-panel__divider" />

      <SettingsWishlist />

      <hr className="settings-context-panel__divider" />

      <SettingsMods />

      <hr className="settings-context-panel__divider" />

      <SettingsCriticScores />

      <hr className="settings-context-panel__divider" />

      <div className="settings-context-panel__group">
        <h3>{t("debrid_services")}</h3>
        <SettingsDebrid />
      </div>

      <hr className="settings-context-panel__divider" />

      {/* Localization sources: keep this block last in Integrations — it is the
          largest section, so every new feature panel goes ABOVE it. */}
      <SettingsLocalizationSources />
    </div>
  );
}
