import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { CheckboxField } from "@renderer/components";
import { useAppSelector } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import { CheckCircleFillIcon, ChevronRightIcon } from "@primer/octicons-react";

import ReleaseCalendarLogo from "@renderer/assets/icons/release-calendar.svg?react";

import "./settings-debrid.scss";
import "./settings-fork-card.scss";
import "@renderer/pages/release-calendar/release-calendar-i18n";
import { useSteamConnected } from "@renderer/pages/release-calendar/use-steam-connected";

const CHEVRON_ICON_SIZE = 16;

// Fork: master switch for the release calendar (profile "Releases" block).
export function SettingsReleaseCalendar() {
  const { t } = useTranslation("release_calendar");
  const { updateUserPreferences } = useContext(settingsContext);
  const preferenceEnabled = useAppSelector(
    (state) => state.userPreferences.value?.releaseCalendarEnabled ?? true
  );
  // Needs the Steam integration: without it the switch is inactive and off.
  const steamConnected = useSteamConnected();
  const enabled = preferenceEnabled && steamConnected === true;
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div
      className={`settings-debrid__section ${
        isCollapsed ? "" : "settings-debrid__section--expanded"
      }`}
    >
      <div className="settings-debrid__section-header">
        <button
          type="button"
          className="settings-debrid__collapse-button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-label={t(isCollapsed ? "settings_expand" : "settings_collapse")}
        >
          <span
            className={`settings-debrid__collapse-icon ${
              isCollapsed ? "" : "settings-debrid__collapse-icon--expanded"
            }`}
          >
            <ChevronRightIcon size={CHEVRON_ICON_SIZE} />
          </span>
        </button>
        <ReleaseCalendarLogo
          className="settings-fork-card__title-logo"
          aria-hidden="true"
        />
        <h3 className="settings-debrid__section-title">{t("title")}</h3>
        {enabled && (
          <CheckCircleFillIcon
            size={CHEVRON_ICON_SIZE}
            className="settings-debrid__check-icon"
          />
        )}
        <div style={{ marginLeft: "auto" }}>
          <CheckboxField
            label=""
            aria-label={t("title")}
            checked={enabled}
            disabled={steamConnected !== true}
            onChange={() =>
              updateUserPreferences({
                releaseCalendarEnabled: !preferenceEnabled,
              })
            }
          />
        </div>
      </div>

      {!isCollapsed && (
        <div className="settings-context-panel__group">
          <p>{t("settings_description")}</p>
          {steamConnected === false && <p>{t("settings_requires_steam")}</p>}
        </div>
      )}
    </div>
  );
}
