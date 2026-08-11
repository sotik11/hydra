import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { BookIcon, PlusIcon, XIcon } from "@primer/octicons-react";
import { orderBy } from "lodash-es";

import { Badge } from "@renderer/components/badge/badge";
import { Link } from "@renderer/components/link/link";
import { useLibrary } from "@renderer/hooks";
import { buildGameDetailsPath } from "@renderer/helpers";
import { levelDBService } from "@renderer/services/leveldb.service";
import { logger } from "@renderer/logger";
import type { DownloadSource, GameRepack, WishlistGame } from "@types";

import steamLogo from "@renderer/assets/icons/steam.png";
import HydraLogo from "@renderer/assets/icons/hydra.svg?react";
import "./wishlist-card.scss";

interface WishlistCardProps {
  game: WishlistGame;
  refreshKey?: number;
  view?: "grid" | "list";
  onRemoved?: (appId: string) => void;
}

export function WishlistCard({
  game,
  refreshKey = 0,
  view = "grid",
  onRemoved,
}: WishlistCardProps) {
  const { t, i18n } = useTranslation("wishlist");
  const ref = useRef<HTMLLIElement>(null);
  const { library, updateLibrary } = useLibrary();

  const shop = "steam" as const;
  const objectId = game.appId;

  const [visible, setVisible] = useState(false);
  const [title, setTitle] = useState<string>(objectId);
  const [cover, setCover] = useState<string | null>(null);
  const [genres, setGenres] = useState<string[]>([]);
  const [sources, setSources] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const inLibrary = library.some(
    (entry) =>
      entry.shop === shop && entry.objectId === objectId && !entry.isDeleted
  );

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;

    window.electron
      .getGameAssets(objectId, shop)
      .then((assets) => {
        if (cancelled || !assets) return;
        if (assets.title) setTitle(assets.title);
        setCover(assets.libraryImageUrl ?? assets.coverImageUrl ?? null);
      })
      .catch(() => {});

    window.electron
      .getGameShopDetails(objectId, shop, i18n.language)
      .then((details) => {
        if (cancelled || !details?.genres) return;
        setGenres(
          details.genres.map((genre) => genre.name).filter(Boolean)
        );
      })
      .catch(() => {});

    (async () => {
      try {
        const sourcesRaw = (await levelDBService.values(
          "downloadSources"
        )) as DownloadSource[];
        const ordered = orderBy(sourcesRaw, "createdAt", "desc");

        const repacks = await window.electron.hydraApi.get<GameRepack[]>(
          `/games/${shop}/${objectId}/download-sources`,
          {
            params: {
              take: 100,
              skip: 0,
              downloadSourceIds: ordered.map((source) => source.id),
            },
            needsAuth: false,
          }
        );

        if (cancelled || !Array.isArray(repacks)) return;

        setSources([
          ...new Set(repacks.map((repack) => repack.downloadSourceName)),
        ]);
      } catch (error) {
        logger.warn(`[wishlist] sources failed for ${objectId}:`, error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [visible, objectId, i18n.language, refreshKey]);

  const handleRemove = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    try {
      await window.electron.removeWishlistGame(objectId);
      onRemoved?.(objectId);
    } catch {
      setBusy(false);
    }
  };

  const handleAddToLibrary = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setBusy(true);
    try {
      await window.electron.addGameToLibrary(shop, objectId, title, null);
      updateLibrary();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li ref={ref} className={`wishlist-card wishlist-card--${view}`}>
      <Link
        to={buildGameDetailsPath({ shop, objectId, title })}
        className="wishlist-card__link"
        title={title}
      >
        <div className="wishlist-card__cover">
          {cover ? (
            <img src={cover} alt={title} loading="lazy" />
          ) : (
            <div className="wishlist-card__cover-placeholder" />
          )}

          <div className="wishlist-card__badges">
            {game.source === "steam" && (
              <span className="wishlist-card__badge">
                <img src={steamLogo} alt="Steam" />
              </span>
            )}
            {game.source === "manual" && (
              <span className="wishlist-card__badge">
                <HydraLogo width={14} height={14} />
              </span>
            )}
            {inLibrary && (
              <span className="wishlist-card__badge wishlist-card__badge--library">
                <BookIcon size={14} />
              </span>
            )}
          </div>
        </div>

        <div className="wishlist-card__info">
          <span className="wishlist-card__title">{title}</span>
          {genres.length > 0 && (
            <span className="wishlist-card__genres">{genres.join(", ")}</span>
          )}
          <div className="wishlist-card__sources">
            {sources.map((source) => (
              <Badge key={source}>{source}</Badge>
            ))}
          </div>
        </div>

        <div className="wishlist-card__actions">
          {!inLibrary && (
            <button
              type="button"
              className="wishlist-card__action"
              onClick={handleAddToLibrary}
              disabled={busy}
              title={t("add_to_library")}
              aria-label={t("add_to_library")}
            >
              <PlusIcon size={14} />
            </button>
          )}
          <button
            type="button"
            className="wishlist-card__action wishlist-card__action--remove"
            onClick={handleRemove}
            disabled={busy}
            title={t("remove_from_wishlist")}
            aria-label={t("remove_from_wishlist")}
          >
            <XIcon size={14} />
          </button>
        </div>
      </Link>
    </li>
  );
}
