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
  sources: string[];
  loaded: boolean;
}

const CONCURRENCY = 4;

function emptyMeta(appId: string): WishlistGameMeta {
  return {
    appId,
    title: appId,
    cover: null,
    genres: [],
    releaseYear: null,
    sources: [],
    loaded: false,
  };
}

async function resolveOne(
  appId: string,
  language: string,
  downloadSourceIds: string[]
): Promise<WishlistGameMeta> {
  const meta = emptyMeta(appId);

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
  } catch {
    // keep defaults
  }

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
 * Progressively resolve metadata (title/genres/year/sources) for every wishlist
 * game, with a small concurrency pool. Returns a map keyed by appId that fills
 * in over time, plus a "ready" flag when all games are resolved.
 */
export function useWishlistMetadata(games: WishlistGame[], refreshKey: number) {
  const { i18n } = useTranslation();
  const [metaById, setMetaById] = useState<Record<string, WishlistGameMeta>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setMetaById(
      Object.fromEntries(games.map((game) => [game.appId, emptyMeta(game.appId)]))
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
          const meta = await resolveOne(
            next.appId,
            i18n.language,
            downloadSourceIds
          );
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
