import { useContext, useState } from "react";
import { useTranslation } from "react-i18next";

import { CheckboxField } from "@renderer/components";
import { useAppSelector } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import {
  CheckCircleFillIcon,
  ChevronRightIcon,
  CircleIcon,
} from "@primer/octicons-react";

import CriticScoresLogo from "@renderer/assets/icons/critic-scores.svg?react";

import "./settings-debrid.scss";
import "./settings-retroachievements.scss";
import "./settings-critic-scores.scss";
import "./critic-scores-i18n";

const CHEVRON_ICON_SIZE = 16;

export function SettingsCriticScores() {
  const { t } = useTranslation("critic_scores");
  const { updateUserPreferences } = useContext(settingsContext);
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const enabled = userPreferences?.criticScoresEnabled ?? true;
  const metacriticEnabled =
    userPreferences?.criticScoresMetacriticEnabled ?? true;

  const [isCollapsed, setIsCollapsed] = useState(true);

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
          aria-label={
            isCollapsed
              ? t("critic_scores_expand")
              : t("critic_scores_collapse")
          }
        >
          <span
            className={`settings-debrid__collapse-icon ${
              isCollapsed ? "" : "settings-debrid__collapse-icon--expanded"
            }`}
          >
            <ChevronRightIcon size={CHEVRON_ICON_SIZE} />
          </span>
        </button>
        <h3 className="settings-debrid__section-title">
          {t("critic_scores_title")}
        </h3>
        <CriticScoresLogo
          className="settings-retroachievements__title-logo"
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
            aria-label={t("critic_scores_title")}
            checked={enabled}
            onChange={() =>
              updateUserPreferences({ criticScoresEnabled: !enabled })
            }
          />
        </div>
      </div>

      {!isCollapsed && enabled && (
        <div className="settings-context-panel__group">
          <p>{t("critic_scores_description")}</p>

          <ul className="settings-critic-scores__sources">
            <li className="settings-critic-scores__source">
              <button
                type="button"
                role="switch"
                aria-checked={metacriticEnabled}
                aria-label={t("critic_scores_source_metacritic")}
                className={`settings-critic-scores__toggle ${
                  metacriticEnabled ? "settings-critic-scores__toggle--on" : ""
                }`}
                onClick={() =>
                  updateUserPreferences({
                    criticScoresMetacriticEnabled: !metacriticEnabled,
                  })
                }
              >
                {metacriticEnabled ? (
                  <CheckCircleFillIcon size={14} />
                ) : (
                  <CircleIcon size={14} />
                )}
              </button>
              <span className="settings-critic-scores__source-name">
                {t("critic_scores_source_metacritic")}
              </span>
            </li>

            {/* OpenCritic is stage 2 — shown disabled so the layout matches the
                target design and signals what's coming. */}
            <li className="settings-critic-scores__source settings-critic-scores__source--disabled">
              <button
                type="button"
                role="switch"
                aria-checked={false}
                aria-label={t("critic_scores_source_opencritic")}
                className="settings-critic-scores__toggle"
                disabled
              >
                <CircleIcon size={14} />
              </button>
              <span className="settings-critic-scores__source-name">
                {t("critic_scores_source_opencritic")}
                <span className="settings-critic-scores__source-soon">
                  ({t("critic_scores_soon")})
                </span>
              </span>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
