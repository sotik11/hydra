import { DownloadIcon, StarFillIcon } from "@primer/octicons-react";
import { useTranslation } from "react-i18next";
import type { ReleaseCalendarGame } from "@types";
import "./release-calendar-i18n";
import "./release-markers.scss";

interface ReleaseMarkersProps {
  game: ReleaseCalendarGame;
  showEarlyAccess?: boolean;
}

export function ReleaseMarkers({
  game,
  showEarlyAccess = false,
}: Readonly<ReleaseMarkersProps>) {
  const { t } = useTranslation("release_calendar");

  if (!game.isWishlisted && !game.isAvailable && !showEarlyAccess) return null;

  return (
    <span className="release-markers">
      {game.isWishlisted && (
        <span
          className="release-markers__wishlist"
          title={t("marker_wishlist")}
        >
          <StarFillIcon size={12} />
        </span>
      )}
      {game.isAvailable && (
        <span
          className="release-markers__available"
          title={t("marker_available")}
        >
          <DownloadIcon size={12} />
        </span>
      )}
      {showEarlyAccess && game.isEarlyAccess && (
        <span className="release-markers__tag">{t("marker_early_access")}</span>
      )}
      {showEarlyAccess && game.isOwned && (
        <span className="release-markers__tag">{t("marker_owned")}</span>
      )}
    </span>
  );
}
