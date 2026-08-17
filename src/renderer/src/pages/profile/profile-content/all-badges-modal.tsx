import { useContext, useId } from "react";
import { useTranslation } from "react-i18next";
import { Tooltip } from "react-tooltip";
import { Modal } from "@renderer/components";
import { userProfileContext } from "@renderer/context";
import { useDate } from "@renderer/hooks";
import type { Badge } from "@types";
import "./all-badges-modal.scss";

interface AllBadgesModalProps {
  visible: boolean;
  onClose: () => void;
}

export function AllBadgesModal({
  visible,
  onClose,
}: Readonly<AllBadgesModalProps>) {
  const { t } = useTranslation("user_profile");
  const { formatDate } = useDate();
  const tooltipId = useId();
  const { userProfile, badges } = useContext(userProfileContext);

  const unlockDates = new Map(
    userProfile?.badgesDetails?.map((b) => [b.badge, b.unlockedAt])
  );

  // Fork: show the whole catalogue — earned badges first (full colour), then the
  // not-yet-earned ones dimmed, so the profile owner sees what's left to unlock.
  const earnedNames = new Set(userProfile?.badges ?? []);

  const earnedBadges = (userProfile?.badges ?? [])
    .map((badgeName) => badges.find((b) => b.name === badgeName))
    .filter((badge): badge is Badge => badge !== undefined);

  const lockedBadges = badges.filter((badge) => !earnedNames.has(badge.name));

  const allBadges = [...earnedBadges, ...lockedBadges];

  const modalTitle = (
    <div className="all-badges-modal__title">
      {t("badges")}
      {badges.length > 0 && (
        <span className="all-badges-modal__count">
          {earnedBadges.length} / {badges.length}
        </span>
      )}
    </div>
  );

  return (
    <Modal visible={visible} title={modalTitle} onClose={onClose}>
      <div className="all-badges-modal">
        <div className="all-badges-modal__list">
          {allBadges.map((badge) => {
            const isEarned = earnedNames.has(badge.name);
            const unlockedAt = unlockDates.get(badge.name);
            const tooltipContent =
              isEarned && unlockedAt
                ? t("badge_unlocked_on", { date: formatDate(unlockedAt) })
                : undefined;

            return (
              <div
                key={badge.name}
                className={`all-badges-modal__item ${
                  isEarned ? "" : "all-badges-modal__item--locked"
                }`}
              >
                <div
                  className="all-badges-modal__item-icon"
                  data-tooltip-id={tooltipId}
                  data-tooltip-place="top"
                  data-tooltip-content={tooltipContent}
                >
                  <img
                    src={badge.badge.url}
                    alt={badge.name}
                    width={32}
                    height={32}
                  />
                </div>
                <div className="all-badges-modal__item-content">
                  <h3 className="all-badges-modal__item-title">
                    {badge.title}
                  </h3>
                  <p className="all-badges-modal__item-description">
                    {badge.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
        <Tooltip id={tooltipId} />
      </div>
    </Modal>
  );
}
