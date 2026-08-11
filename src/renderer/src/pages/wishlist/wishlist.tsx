import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  StarIcon,
  SyncIcon,
  AppsIcon,
  ListUnorderedIcon,
} from "@primer/octicons-react";

import { Button } from "@renderer/components";
import type { WishlistGame } from "@types";

import { WishlistCard } from "./wishlist-card";
import "./wishlist-page-i18n";
import "./wishlist.scss";

type WishlistView = "grid" | "list";

export default function Wishlist() {
  const { t } = useTranslation("wishlist");
  const [games, setGames] = useState<WishlistGame[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<WishlistView>(() =>
    localStorage.getItem("wishlist-view") === "list" ? "list" : "grid"
  );

  const loadGames = useCallback(() => {
    window.electron
      .getWishlistGames()
      .then((list) => setGames(list))
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  const handleRefresh = () => {
    loadGames();
    setRefreshKey((key) => key + 1);
  };

  const changeView = (next: WishlistView) => {
    setView(next);
    localStorage.setItem("wishlist-view", next);
  };

  if (games === null) return null;

  if (games.length === 0) {
    return (
      <div className="wishlist__empty">
        <StarIcon size={48} className="wishlist__empty-icon" />
        <h2>{t("empty_title")}</h2>
        <p>{t("empty_hint")}</p>
      </div>
    );
  }

  const sorted = [...games].sort((a, b) => b.addedAt - a.addedAt);

  return (
    <div className="wishlist">
      <div className="wishlist__header">
        <div className="wishlist__header-info">
          <h1 className="wishlist__title">{t("page_title")}</h1>
          <span className="wishlist__count">
            {t("count_games", { count: games.length })}
          </span>
        </div>

        <div className="wishlist__header-actions">
          <div className="wishlist__view-toggle">
            <button
              type="button"
              className={`wishlist__view-button ${
                view === "grid" ? "wishlist__view-button--active" : ""
              }`}
              onClick={() => changeView("grid")}
              aria-label="grid"
            >
              <AppsIcon size={16} />
            </button>
            <button
              type="button"
              className={`wishlist__view-button ${
                view === "list" ? "wishlist__view-button--active" : ""
              }`}
              onClick={() => changeView("list")}
              aria-label="list"
            >
              <ListUnorderedIcon size={16} />
            </button>
          </div>

          <Button theme="outline" onClick={handleRefresh}>
            <SyncIcon size={14} />
            {t("refresh")}
          </Button>
        </div>
      </div>

      <ul
        className={`wishlist__grid ${
          view === "list" ? "wishlist__grid--list" : ""
        }`}
      >
        {sorted.map((game) => (
          <WishlistCard
            key={game.appId}
            game={game}
            refreshKey={refreshKey}
            view={view}
          />
        ))}
      </ul>
    </div>
  );
}
