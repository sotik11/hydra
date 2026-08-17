import { useTranslation } from "react-i18next";
import { LinkExternalIcon } from "@primer/octicons-react";

import { SidebarSection } from "../sidebar-section/sidebar-section";
import MetacriticLogo from "@renderer/assets/icons/metacritic.svg?react";

import "../../settings/critic-scores-i18n";
import "./critic-scores-section.scss";

interface CriticScoresSectionProps {
  metacriticScore: number;
  metacriticUrl: string;
}

// Metacritic colour bands: green 75+, yellow 50–74, red below.
const scoreModifier = (score: number) => {
  if (score >= 75) return "critic-scores__score--high";
  if (score >= 50) return "critic-scores__score--medium";
  return "critic-scores__score--low";
};

export function CriticScoresSection({
  metacriticScore,
  metacriticUrl,
}: Readonly<CriticScoresSectionProps>) {
  const { t } = useTranslation("critic_scores");

  return (
    <SidebarSection title={t("critic_scores_panel_title")}>
      <div className="critic-scores">
        <button
          type="button"
          className="critic-scores__row"
          onClick={() => window.electron.openExternal(metacriticUrl)}
          title={t("critic_scores_metacritic_link")}
        >
          <span
            className={`critic-scores__score ${scoreModifier(metacriticScore)}`}
          >
            {metacriticScore}
          </span>

          <span className="critic-scores__info">
            <span className="critic-scores__brand">
              <MetacriticLogo
                className="critic-scores__brand-logo"
                aria-hidden="true"
              />
              <span className="critic-scores__brand-name">metacritic</span>
            </span>
            <span className="critic-scores__link">
              {t("critic_scores_metacritic_link")}
              <LinkExternalIcon size={12} />
            </span>
          </span>
        </button>
      </div>
    </SidebarSection>
  );
}
