import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { orderBy } from "lodash-es";

import { levelDBService } from "@renderer/services/leveldb.service";
import { logger } from "@renderer/logger";
import type { DownloadSource, GameRepack, WishlistGame } from "@types";

export interface WishlistGameMeta {
  appId: string;
  title: string;
  cover: string | null;
  genres: string[];
  releaseYear: number | null;
  appType: string | null;
  sources: string[];
  loaded: boolean;
  hidden: boolean;
}

const CONCURRENCY = 4;

// A wishlist entry is "junk" once resolved if it's a non-game Steam app (DLC,
// soundtrack, demo, ...) or it doesn't resolve at all (delisted — no title and
// no cover, just the bare appId). Such entries are hidden from the screen.
function isJunk(meta: WishlistGameMeta): boolean {
  if (meta.appType && meta.appType !== "game") return true;
  if (meta.title === meta.appId && !meta.cover) return true;
  return false;
}

// Seed a game's meta from whatever the store already cached. Title/cover/genres/
// year survive here between sessions, so search and title-sort work instantly on
// open — only the repack sources still need a fresh fetch.
function fromCache(game: WishlistGame): WishlistGameMeta {
  return {
    appId: game.appId,
    title: game.title ?? game.appId,
    cover: game.cover ?? null,
    genres: game.genres ?? [],
    releaseYear: game.releaseYear ?? null,
    appType: game.appType ?? null,
    sources: [],
    loaded: false,
    hidden: false,
  };
}

async function resolveOne(
  game: WishlistGame,
  language: string,
  downloadSourceIds: string[]
): Promise<WishlistGameMeta> {
  const meta = fromCache(game);
  const appId = game.appId;

  // Static metadata (title/cover/genres/year) is resolved once and cached in the
  // store; skip the network round-trips when we already have it.
  if (!game.metaCachedAt) {
    try {
      const assets = await window.electron.getGameAssets(appId, "steam");
      if (assets?.title) meta.title = assets.title;
      meta.cover = assets?.libraryImageUrl ?? assets?.coverImageUrl ?? null;
    } catch {
      // keep defaults
    }

    try {
      const details = await window.electron.getGameShopDetails(
        appId,
        "steam",
        language
      );
      if (details?.genres) {
        meta.genres = details.genres.map((genre) => genre.name).filter(Boolean);
      }
      const rawDate = details?.release_date?.date;
      if (rawDate) {
        const match = rawDate.match(/(\d{4})/);
        if (match) meta.releaseYear = Number(match[1]);
      }
      // Steam returns an app "type" that isn't in our typed model; read it raw.
      const appType = (details as { type?: string } | null)?.type;
      if (appType) meta.appType = appType;
    } catch {
      // keep defaults
    }

    // Write the resolved static metadata back so next time it's instant.
    window.electron
      .updateWishlistMeta(appId, {
        title: meta.title,
        cover: meta.cover,
        genres: meta.genres,
        releaseYear: meta.releaseYear,
        appType: meta.appType,
      })
      .catch((error) => {
        logger.warn(`[wishlist] meta cache write failed for ${appId}:`, error);
      });
  }

  // Non-game / delisted junk: hide it and skip the sources fetch entirely.
  meta.hidden = isJunk(meta);
  if (meta.hidden) {
    meta.loaded = true;
    return meta;
  }

  // Repack sources are always fetched fresh — they change over time and drive
  // the "only with a repack" filter and (later) the repack reminders.
  try {
    const repacks = await window.electron.hydraApi.get<GameRepack[]>(
      `/games/steam/${appId}/download-sources`,
      {
        params: { take: 100, skip: 0, downloadSourceIds },
        needsAuth: false,
      }
    );
    if (Array.isArray(repacks)) {
      meta.sources = [
        ...new Set(repacks.map((repack) => repack.downloadSourceName)),
      ];
    }
  } catch (error) {
    logger.warn(`[wishlist] meta sources failed for ${appId}:`, error);
  }

  meta.loaded = true;
  return meta;
}

/**
 * Progressively resolve metadata for every wishlist game with a small
 * concurrency pool. Static fields (title/genres/year) come straight from the
 * store cache when present — so the returned map is already useful for search
 * and title-sort on the first render — while repack sources always refresh.
 * Returns a map keyed by appId plus a "ready" flag when all games are resolved.
 */
export function useWishlistMetadata(games: WishlistGame[], refreshKey: number) {
  const { i18n } = useTranslation();
  const [metaById, setMetaById] = useState<Record<string, WishlistGameMeta>>(
    {}
  );
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setMetaById(
      Object.fromEntries(games.map((game) => [game.appId, fromCache(game)]))
    );

    if (games.length === 0) {
      setReady(true);
      return;
    }

    (async () => {
      const sourcesRaw = (await levelDBService
        .values("downloadSources")
        .catch(() => [])) as DownloadSource[];
      const downloadSourceIds = orderBy(sourcesRaw, "createdAt", "desc").map(
        (source) => source.id
      );

      const queue = [...games];
      const worker = async () => {
        while (!cancelled) {
          const next = queue.shift();
          if (!next) break;
          const meta = await resolveOne(next, i18n.language, downloadSourceIds);
          if (cancelled) return;
          setMetaById((prev) => ({ ...prev, [next.appId]: meta }));
        }
      };

      await Promise.all(
        Array.from({ length: Math.min(CONCURRENCY, games.length) }, worker)
      );

      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [games, i18n.language, refreshKey]);

  return { metaById, ready };
}
