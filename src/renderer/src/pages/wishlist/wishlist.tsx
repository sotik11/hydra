import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  StarIcon,
  SyncIcon,
  AppsIcon,
  ListUnorderedIcon,
  TrashIcon,
} from "@primer/octicons-react";

import { Button, CheckboxField, ConfirmationModal } from "@renderer/components";
import { useAppSelector, useLibrary } from "@renderer/hooks";
import type { WishlistGame } from "@types";

import { WishlistCard } from "./wishlist-card";
import { useWishlistMetadata } from "./use-wishlist-metadata";
import { LibrarySelect } from "../library/library-select";
import "./wishlist-page-i18n";
import "./wishlist.scss";

type WishlistView = "grid" | "list";
type WishlistSort = "added" | "title";

export default function Wishlist() {
  const { t } = useTranslation("wishlist");
  const [games, setGames] = useState<WishlistGame[] | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [view, setView] = useState<WishlistView>(() =>
    localStorage.getItem("wishlist-view") === "list" ? "list" : "grid"
  );
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [sortBy, setSortBy] = useState<WishlistSort>("added");
  const [onlyWithRepack, setOnlyWithRepack] = useState(false);

  const searchTerm = useAppSelector(
    (state) => state.catalogueSearch.filters.title
  );

  const { library } = useLibrary();
  const libraryAppIds = useMemo(
    () =>
      new Set(
        library
          .filter((entry) => entry.shop === "steam" && !entry.isDeleted)
          .map((entry) => entry.objectId)
      ),
    [library]
  );

  const { metaById } = useWishlistMetadata(games ?? [], refreshKey);

  const loadGames = useCallback(() => {
    window.electron
      .getWishlistGames()
      .then((list) => setGames(list))
      .catch(() => setGames([]));
  }, []);

  useEffect(() => {
    loadGames();
  }, [loadGames]);

  // Reload when a game becomes available so its green badge shows up right away.
  useEffect(() => {
    const unsubscribe = window.electron.onWishlistGameAvailable(() =>
      loadGames()
    );
    return unsubscribe;
  }, [loadGames]);

  const handleRefresh = () => {
    loadGames();
    setRefreshKey((key) => key + 1);
    window.electron.refreshWishlistReminders().catch(() => {});
  };

  const handleRemoved = (appId: string) => {
    setGames((prev) => (prev ? prev.filter((g) => g.appId !== appId) : prev));
  };

  const handleClear = async () => {
    await window.electron.clearWishlist().catch(() => {});
    setGames([]);
    setShowClearConfirm(false);
  };

  const changeView = (next: WishlistView) => {
    setView(next);
    localStorage.setItem("wishlist-view", next);
  };

  const displayed = useMemo(() => {
    if (!games) return [];
    const term = searchTerm.trim().toLowerCase();

    const filtered = games.filter((game) => {
      const meta = metaById[game.appId];
      // A game already in the library is never shown in the wishlist. Removing it
      // from the library brings it back here (it's a filter, not a hard delete).
      if (libraryAppIds.has(game.appId)) return false;
      // Drop resolved junk (non-game apps / delisted entries).
      if (meta?.hidden) return false;
      if (onlyWithRepack && (!meta || meta.sources.length === 0)) return false;
      if (term) {
        const title = (meta?.title ?? game.appId).toLowerCase();
        if (!title.includes(term)) return false;
      }
      return true;
    });

    if (sortBy === "title") {
      return [...filtered].sort((a, b) =>
        (metaById[a.appId]?.title ?? a.appId).localeCompare(
          metaById[b.appId]?.title ?? b.appId
        )
      );
    }

    return [...filtered].sort((a, b) => b.addedAt - a.addedAt);
  }, [games, metaById, sortBy, onlyWithRepack, searchTerm, libraryAppIds]);

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

  return (
    <div className="wishlist">
      <div className="wishlist__header">
        <div className="wishlist__summary">
          <span className="wishlist__count">
            {t("count_games", { count: displayed.length })}
          </span>
          <span className="wishlist__hint">{t("filters_hint")}</span>
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

          <Button theme="danger" onClick={() => setShowClearConfirm(true)}>
            <TrashIcon size={14} />
            {t("clear")}
          </Button>
        </div>
      </div>

      <div className="wishlist__toolbar">
        <CheckboxField
          label={t("filter_with_repack")}
          checked={onlyWithRepack}
          onChange={() => setOnlyWithRepack((value) => !value)}
        />

        <div className="wishlist__sort">
          <span className="wishlist__sort-label">{t("sort_by")}</span>
          <LibrarySelect
            value={sortBy}
            ariaLabel={t("sort_by")}
            onChange={(value) => setSortBy(value as WishlistSort)}
            options={[
              { value: "added", label: t("sort_added") },
              { value: "title", label: t("sort_title") },
            ]}
          />
        </div>
      </div>

      <ConfirmationModal
        visible={showClearConfirm}
        title={t("clear_confirm_title")}
        descriptionText={t("clear_confirm_description")}
        confirmButtonLabel={t("clear")}
        cancelButtonLabel={t("clear_cancel")}
        onConfirm={handleClear}
        onClose={() => setShowClearConfirm(false)}
      />

      <ul
        className={`wishlist__grid ${
          view === "list" ? "wishlist__grid--list" : ""
        }`}
      >
        {displayed.map((game) => (
          <WishlistCard
            key={game.appId}
            game={game}
            refreshKey={refreshKey}
            view={view}
            onRemoved={handleRemoved}
          />
        ))}
      </ul>
    </div>
  );
}
