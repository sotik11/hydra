import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Flame, Sparkles, RefreshCw, Heart } from "lucide-react";
import { LinkExternalIcon } from "@primer/octicons-react";

import { Button, Modal } from "@renderer/components";
import type { NexusHighlights, NexusMatch, NexusModCard } from "@types";

import "@renderer/pages/settings/mods-i18n";
import "./mods-modal.scss";

export interface ModsModalProps {
  visible: boolean;
  onClose: () => void;
  match: NexusMatch | null;
}

type TabKey = "trending" | "latestAdded" | "latestUpdated";

const ICON_SIZE = 15;

const formatEndorsements = (value: number): string => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return String(value);
};

export function ModsModal({
  visible,
  onClose,
  match,
}: Readonly<ModsModalProps>) {
  const { t, i18n } = useTranslation("mods");

  const [tab, setTab] = useState<TabKey>("trending");
  const [highlights, setHighlights] = useState<NexusHighlights | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const domain = match?.domain ?? "";

  useEffect(() => {
    if (!visible || !domain) return;

    let cancelled = false;
    setTab("trending");
    setHighlights(null);
    setIsLoading(true);

    window.electron
      .getNexusHighlights(domain)
      .then((result) => {
        if (!cancelled) setHighlights(result);
      })
      .catch(() => {
        if (!cancelled) setHighlights(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, domain]);

  const modUrl = (modId: number) =>
    `https://www.nexusmods.com/${domain}/mods/${modId}`;
  const allModsUrl = `https://www.nexusmods.com/${domain}/mods`;

  const formatDate = (unixSeconds: number): string => {
    if (!unixSeconds) return "";
    return new Date(unixSeconds * 1000).toLocaleDateString(i18n.language);
  };

  const tabs: { key: TabKey; label: string; icon: JSX.Element }[] = [
    {
      key: "trending",
      label: t("mods_modal_trending"),
      icon: <Flame size={ICON_SIZE} />,
    },
    {
      key: "latestAdded",
      label: t("mods_modal_new"),
      icon: <Sparkles size={ICON_SIZE} />,
    },
    {
      key: "latestUpdated",
      label: t("mods_modal_updated"),
      icon: <RefreshCw size={ICON_SIZE} />,
    },
  ];

  const cards: NexusModCard[] = highlights ? highlights[tab] : [];

  const renderGrid = () => {
    if (isLoading) {
      return (
        <div className="mods-modal__status">{t("mods_modal_loading")}</div>
      );
    }

    if (cards.length === 0) {
      return <div className="mods-modal__status">{t("mods_modal_empty")}</div>;
    }

    return (
      <div className="mods-modal__grid">
        {cards.map((card) => (
          <button
            key={card.modId}
            type="button"
            className="mods-modal__card"
            onClick={() => window.electron.openExternal(modUrl(card.modId))}
          >
            <div className="mods-modal__thumb">
              {card.pictureUrl ? (
                <img src={card.pictureUrl} alt={card.name} loading="lazy" />
              ) : (
                <Flame size={26} />
              )}
            </div>
            <div className="mods-modal__card-body">
              <p className="mods-modal__card-title">{card.name}</p>
              {card.author && (
                <p className="mods-modal__card-author">{card.author}</p>
              )}
              <div className="mods-modal__card-meta">
                <span className="mods-modal__endorsements">
                  <Heart size={13} />
                  {formatEndorsements(card.endorsements)}
                </span>
                <span className="mods-modal__date">
                  {formatDate(card.updatedAt)}
                </span>
              </div>
            </div>
          </button>
        ))}
      </div>
    );
  };

  return (
    <Modal
      visible={visible}
      title={t("mods_modal_title")}
      description={
        match?.name
          ? `${match.name} · ${t("mods_modal_source")}`
          : t("mods_modal_source")
      }
      onClose={onClose}
      className="mods-modal__window"
    >
      <div className="mods-modal__tabs">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`mods-modal__tab ${
              tab === item.key ? "mods-modal__tab--active" : ""
            }`}
            onClick={() => setTab(item.key)}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      {renderGrid()}

      <Button
        type="button"
        theme="outline"
        className="mods-modal__all"
        onClick={() => window.electron.openExternal(allModsUrl)}
      >
        {t("mods_modal_all")}
        <LinkExternalIcon size={16} />
      </Button>
    </Modal>
  );
}
