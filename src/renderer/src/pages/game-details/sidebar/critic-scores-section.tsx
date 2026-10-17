import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { LinkExternalIcon } from "@primer/octicons-react";
import type { ExternalCriticScores, GameShop } from "@types";

import { SidebarSection } from "../sidebar-section/sidebar-section";
import MetacriticLogo from "@renderer/assets/icons/metacritic.svg?react";
import OpenCriticLogo from "@renderer/assets/icons/opencritic.svg?react";
import EpicLogo from "@renderer/assets/epic-integration-logo.svg?react";

import "../../settings/critic-scores-i18n";
import "./critic-scores-section.scss";

interface CriticScoresSectionProps {
  shop: GameShop;
  objectId: string;
  // Metacritic *critic* score comes from Steam appdetails (Metacritic doesn't
  // license it elsewhere); may be absent for many games.
  steamMetacritic: { score: number; url: string } | null;
  // No Steam shop details on this page (an Epic copy of a Steam game): fetch
  // the Metacritic critic score from Steam appdetails by the linked appid.
  fetchMetacritic?: boolean;
  showMetacritic: boolean;
  showMetacriticUser: boolean;
  showOpenCritic: boolean;
  // Epic game ("namespace:itemId"): OpenCritic + Epic player rating from the
  // Epic storefront — the only source for Epic exclusives.
  epicObjectId?: string;
  showEpicRating?: boolean;
}

// Colour bands by score (0–100), shared across sources.
const scoreModifier = (score: number) => {
  if (score >= 75) return "critic-scores__score--high";
  if (score >= 50) return "critic-scores__score--medium";
  return "critic-scores__score--low";
};

interface RowProps {
  score: number;
  url: string;
  logo: React.ReactNode;
  name: string;
  linkLabel: string;
  // Shown instead of the 0–100 score (e.g. "4.3 / 5"); colour still uses score.
  displayScore?: string;
}

function CriticRow({
  score,
  url,
  logo,
  name,
  linkLabel,
  displayScore,
}: Readonly<RowProps>) {
  return (
    <button
      type="button"
      className="critic-scores__row"
      onClick={() => {
        if (url) window.electron.openExternal(url);
      }}
      title={linkLabel}
    >
      <span className={`critic-scores__score ${scoreModifier(score)}`}>
        {displayScore ?? score}
      </span>

      <span className="critic-scores__info">
        <span className="critic-scores__brand">
          {logo}
          <span className="critic-scores__brand-name">{name}</span>
        </span>
        <span className="critic-scores__link">
          {linkLabel}
          <LinkExternalIcon size={12} />
        </span>
      </span>
    </button>
  );
}

export function CriticScoresSection({
  shop,
  objectId,
  steamMetacritic,
  fetchMetacritic = false,
  showMetacritic,
  showMetacriticUser,
  showOpenCritic,
  epicObjectId,
  showEpicRating = false,
}: Readonly<CriticScoresSectionProps>) {
  const { t } = useTranslation("critic_scores");
  const [external, setExternal] = useState<ExternalCriticScores | null>(null);

  // Augmented Steam feeds the Metacritic user score + OpenCritic, by Steam appid.
  const needsExternal =
    shop === "steam" &&
    (showMetacriticUser ||
      showOpenCritic ||
      (fetchMetacritic && showMetacritic));

  useEffect(() => {
    if (!needsExternal || !objectId) {
      setExternal(null);
      return;
    }

    let active = true;
    window.electron
      .getCriticScores(shop, objectId, fetchMetacritic)
      .then((data) => {
        if (active) setExternal(data);
      })
      .catch(() => {
        if (active) setExternal(null);
      });

    return () => {
      active = false;
    };
  }, [shop, objectId, needsExternal, fetchMetacritic]);

  const [epicScores, setEpicScores] = useState<ExternalCriticScores | null>(
    null
  );
  const needsEpic = !!epicObjectId && (showOpenCritic || showEpicRating);

  useEffect(() => {
    if (!needsEpic || !epicObjectId) {
      setEpicScores(null);
      return;
    }

    let active = true;
    window.electron
      .getCriticScores("epic", epicObjectId)
      .then((data) => {
        if (active) setEpicScores(data);
      })
      .catch(() => {
        if (active) setEpicScores(null);
      });

    return () => {
      active = false;
    };
  }, [epicObjectId, needsEpic]);

  const rows: React.ReactNode[] = [];
  const metacritic = steamMetacritic ?? external?.metacritic ?? null;

  if (showMetacritic && metacritic) {
    rows.push(
      <CriticRow
        key="mc"
        score={metacritic.score}
        url={metacritic.url}
        logo={
          <MetacriticLogo
            className="critic-scores__brand-logo"
            aria-hidden="true"
          />
        }
        name="metacritic"
        linkLabel={t("critic_scores_metacritic_link")}
      />
    );
  }

  if (showMetacriticUser && external?.metacriticUser) {
    rows.push(
      <CriticRow
        key="mc-user"
        score={external.metacriticUser.score}
        url={external.metacriticUser.url}
        logo={
          <MetacriticLogo
            className="critic-scores__brand-logo"
            aria-hidden="true"
          />
        }
        name={t("critic_scores_metacritic_user_name")}
        linkLabel={t("critic_scores_metacritic_user_link")}
      />
    );
  }

  // OpenCritic: by Steam appid when there is one, else from the Epic storefront.
  const openCritic = external?.openCritic ?? epicScores?.openCritic ?? null;
  if (showOpenCritic && openCritic) {
    const { score, url, verdict } = openCritic;
    rows.push(
      <CriticRow
        key="oc"
        score={score}
        url={url}
        logo={
          <OpenCriticLogo
            className="critic-scores__brand-logo"
            aria-hidden="true"
          />
        }
        name="OpenCritic"
        linkLabel={
          verdict
            ? `${verdict} — ${t("critic_scores_opencritic_link")}`
            : t("critic_scores_opencritic_link")
        }
      />
    );
  }

  const epicRating = epicScores?.epicPlayerRating;
  if (showEpicRating && epicRating) {
    rows.push(
      <CriticRow
        key="epic-rating"
        score={Math.round((epicRating.average / 5) * 100)}
        displayScore={`${epicRating.average.toFixed(1)} / 5`}
        url={epicRating.url}
        logo={
          <EpicLogo className="critic-scores__brand-logo" aria-hidden="true" />
        }
        name={t("critic_scores_epic_rating_name")}
        linkLabel={t("critic_scores_epic_rating_link")}
      />
    );
  }

  if (rows.length === 0) return null;

  return (
    <SidebarSection title={t("critic_scores_panel_title")}>
      <div className="critic-scores">{rows}</div>
    </SidebarSection>
  );
}
