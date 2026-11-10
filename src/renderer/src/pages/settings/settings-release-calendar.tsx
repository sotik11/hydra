import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { CheckboxField } from "@renderer/components";
import { useAppSelector } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import {
  CalendarIcon,
  CheckCircleFillIcon,
  ChevronRightIcon,
} from "@primer/octicons-react";

import "./settings-debrid.scss";
import "./settings-fork-card.scss";
import "@renderer/pages/release-calendar/release-calendar-i18n";

const CHEVRON_ICON_SIZE = 16;

// Fork: master switch for the release calendar (profile "Releases" block).
export function SettingsReleaseCalendar() {
  const { t } = useTranslation("release_calendar");
  const { updateUserPreferences } = useContext(settingsContext);
  const enabled = useAppSelector(
    (state) => state.userPreferences.value?.releaseCalendarEnabled ?? true
  );
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
        <h3 className="settings-debrid__section-title">{t("title")}</h3>
        <CalendarIcon
          className="settings-fork-card__title-logo"
          aria-hidden="true"
        />
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
            onChange={() =>
              updateUserPreferences({ releaseCalendarEnabled: !enabled })
            }
          />
        </div>
      </div>

      {!isCollapsed && (
        <div className="settings-context-panel__group">
          <p>{t("settings_description")}</p>
        </div>
      )}
    </div>
  );
}
