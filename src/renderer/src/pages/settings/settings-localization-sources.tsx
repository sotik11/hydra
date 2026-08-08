import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import {
  Badge,
  Button,
  CheckboxField,
  ConfirmationModal,
  Modal,
  TextField,
} from "@renderer/components";
import {
  LinkExternalIcon,
  NoEntryIcon,
  PlusCircleIcon,
  SyncIcon,
  TrashIcon,
} from "@primer/octicons-react";
import { useToast } from "@renderer/hooks";
import { buildGameDetailsPath } from "@renderer/helpers";
import { useNavigate } from "react-router-dom";
import { orderBy } from "lodash-es";
import type { LocalizationSource, LocalizationSourceGame } from "@types";
import { AddLocalizationSourceModal } from "./add-localization-source-modal";
import { logger } from "@renderer/logger";
import "./settings-localization-sources.scss";
import "../game-details/modals/localization-i18n";

interface LocalizationGameCardProps {
  game: LocalizationSourceGame;
  onSelect: (game: LocalizationSourceGame) => void;
}

function LocalizationGameCard({ game, onSelect }: LocalizationGameCardProps) {
  const [cover, setCover] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px" }
    );
    observer.observe(element);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!isVisible) return;

    let cancelled = false;
    window.electron
      .getGameAssets(game.objectId, game.shop)
      .then((assets) => {
        if (!cancelled) setCover(assets?.libraryImageUrl ?? null);
      })
      .catch((error) =>
        logger.warn(
          `[localization] failed to load cover for ${game.shop}:${game.objectId}:`,
          error
        )
      );

    return () => {
      cancelled = true;
    };
  }, [isVisible, game.objectId, game.shop]);

  return (
    <button
      ref={ref}
      type="button"
      className="settings-localization-sources__game-card"
      title={game.title}
      onClick={() => onSelect(game)}
    >
      {cover ? (
        <img
          src={cover}
          alt={game.title}
          className="settings-localization-sources__game-cover"
          loading="lazy"
        />
      ) : (
        <div className="settings-localization-sources__game-cover settings-localization-sources__game-cover--placeholder" />
      )}
      <span className="settings-localization-sources__game-card-title">
        {game.title}
      </span>
    </button>
  );
}

export function SettingsLocalizationSources() {
  const [sources, setSources] = useState<LocalizationSource[]>([]);
  const [builtinGames, setBuiltinGames] = useState<
    Record<string, LocalizationSourceGame[]>
  >({});
  const [gamesModalSource, setGamesModalSource] =
    useState<LocalizationSource | null>(null);
  const [gamesSearchTerm, setGamesSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmDeleteAll, setShowConfirmDeleteAll] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isRemovingAll, setIsRemovingAll] = useState(false);

  const { t } = useTranslation("settings");
  const { showSuccessToast } = useToast();
  const navigate = useNavigate();

  const loadSources = async () => {
    const all = await window.electron.getLocalizationSources();
    const sorted = orderBy(all, ["type", "addedAt"], ["asc", "desc"]);
    setSources(sorted);

    const builtinPairs = await Promise.all(
      sorted
        .filter((source) => source.type === "builtin")
        .map(
          async (source) =>
            [
              source.id,
              await window.electron.getLocalizationSourceGames(source.id),
            ] as const
        )
    );
    setBuiltinGames(Object.fromEntries(builtinPairs));
  };

  useEffect(() => {
    loadSources().catch((error) =>
      logger.error("Failed to load localization sources:", error)
    );
  }, []);

  const gamesForSource = (
    source: LocalizationSource
  ): LocalizationSourceGame[] => {
    if (source.type !== "json") return builtinGames[source.id] ?? [];

    const byId = new Map<string, LocalizationSourceGame>();
    for (const entry of source.entries ?? []) {
      if (!entry.steamAppId || byId.has(entry.steamAppId)) continue;
      byId.set(entry.steamAppId, {
        shop: "steam",
        objectId: entry.steamAppId,
        title: entry.title,
      });
    }
    return [...byId.values()];
  };

  const handleToggle = async (source: LocalizationSource) => {
    await window.electron.setLocalizationSourceEnabled(
      source.id,
      !source.enabled
    );
    await loadSources();
  };

  const handleRemove = async (source: LocalizationSource) => {
    await window.electron.removeLocalizationSource(source.id);
    await loadSources();
    showSuccessToast(t("localization:removed_localization_source"));
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await window.electron.syncLocalizationSources();
      await loadSources();
      showSuccessToast(t("localization:localization_sources_synced"));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRemoveAll = async () => {
    setIsRemovingAll(true);
    try {
      const jsonSources = sources.filter((source) => source.type === "json");
      for (const source of jsonSources) {
        await window.electron.removeLocalizationSource(source.id);
      }
      await loadSources();
      showSuccessToast(t("localization:removed_all_localization_sources"));
    } finally {
      setIsRemovingAll(false);
      setShowConfirmDeleteAll(false);
    }
  };

  const hasJsonSources = sources.some((source) => source.type === "json");

  const openGamesModal = (source: LocalizationSource) => {
    setGamesSearchTerm("");
    setGamesModalSource(source);
  };

  const closeGamesModal = () => {
    setGamesModalSource(null);
    setGamesSearchTerm("");
  };

  const gamesSearchQuery = gamesSearchTerm.trim().toLowerCase();
  const modalGames = (gamesModalSource ? gamesForSource(gamesModalSource) : [])
    .filter((game) => game.title.toLowerCase().includes(gamesSearchQuery))
    .sort((a, b) => a.title.localeCompare(b.title));

  const sourceSiteUrl = (source: LocalizationSource): string | null => {
    if (source.siteUrl) return source.siteUrl;
    if (source.type === "builtin") return source.url ?? null;
    const entry = (source.entries ?? []).find((e) => e.studioUrl || e.pageUrl);
    const url = entry?.studioUrl || entry?.pageUrl;
    if (url) {
      try {
        return new URL(url).origin;
      } catch {
        // fall through to `return null`
      }
    }
    return null;
  };

  const sourceLanguages = (source: LocalizationSource): string[] => {
    const langs = [
      ...new Set(
        (source.entries ?? [])
          .map((e) => e.language)
          .filter((l): l is string => Boolean(l))
      ),
    ];
    if (langs.length) return langs;
    return source.language ? [source.language] : [];
  };

  return (
    <div className="settings-context-panel__group">
      <h3>{t("localization:localization_sources")}</h3>
      <p>{t("localization:localization_sources_description")}</p>

      <AddLocalizationSourceModal
        visible={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAddLocalizationSource={loadSources}
      />

      <ConfirmationModal
        cancelButtonLabel={t("cancel_button_confirmation_delete_all_sources")}
        confirmButtonLabel={t("confirm_button_confirmation_delete_all_sources")}
        descriptionText={t("description_confirmation_delete_all_sources")}
        clickOutsideToClose={false}
        onConfirm={handleRemoveAll}
        visible={showConfirmDeleteAll}
        title={t("title_confirmation_delete_all_sources")}
        onClose={() => setShowConfirmDeleteAll(false)}
        buttonsIsDisabled={isRemovingAll}
      />

      <Modal
        visible={gamesModalSource !== null}
        title={t("localization:localization_source_games_title")}
        onClose={closeGamesModal}
      >
        <div className="settings-localization-sources__games-search">
          <TextField
            placeholder={t("localization:localization_source_games_search")}
            value={gamesSearchTerm}
            onChange={(event) => setGamesSearchTerm(event.target.value)}
          />
        </div>

        <div
          className={`settings-localization-sources__games-grid${
            gamesSearchQuery
              ? " settings-localization-sources__games-grid--search"
              : ""
          }`}
        >
          {modalGames.map((game) => (
            <LocalizationGameCard
              key={`${game.shop}-${game.objectId}`}
              game={game}
              onSelect={(selected) => {
                closeGamesModal();
                navigate(buildGameDetailsPath(selected));
              }}
            />
          ))}
        </div>
      </Modal>

      <div className="settings-localization-sources__header">
        <Button
          type="button"
          theme="outline"
          onClick={handleSync}
          disabled={!hasJsonSources || isSyncing || isRemovingAll}
        >
          <SyncIcon />
          {t("localization:sync_localization_sources")}
        </Button>

        <div className="settings-localization-sources__buttons-container">
          <Button
            type="button"
            theme="danger"
            onClick={() => setShowConfirmDeleteAll(true)}
            disabled={!hasJsonSources || isSyncing || isRemovingAll}
          >
            <TrashIcon />
            {t("localization:remove_all_localization_sources")}
          </Button>

          <Button
            type="button"
            theme="outline"
            onClick={() => setShowAddModal(true)}
            disabled={isSyncing || isRemovingAll}
          >
            <PlusCircleIcon />
            {t("localization:add_localization_source")}
          </Button>
        </div>
      </div>

      <ul className="settings-localization-sources__list">
        {sources.map((source) => {
          const gamesCount = gamesForSource(source).length;
          const siteUrl = sourceSiteUrl(source);
          const languages = sourceLanguages(source);

          return (
            <li key={source.id} className="settings-localization-sources__item">
              <div className="settings-localization-sources__item-title-row">
                <div className="settings-localization-sources__item-title-main">
                  <h2 className="settings-localization-sources__item-title">
                    {siteUrl ? (
                      <button
                        type="button"
                        className="settings-localization-sources__item-title-link"
                        onClick={() => window.electron.openExternal(siteUrl)}
                      >
                        {source.name}
                      </button>
                    ) : (
                      source.name
                    )}
                  </h2>
                  {source.category && (
                    <span className="settings-localization-sources__item-kind">
                      (
                      {t(
                        {
                          studio:
                            "localization:localization_source_kind_studio",
                          "neural-studio":
                            "localization:localization_source_kind_neural_studio",
                          aggregator:
                            "localization:localization_source_kind_aggregator",
                        }[source.category]
                      )}
                      )
                    </span>
                  )}
                </div>
                <div className="settings-localization-sources__item-languages">
                  {languages.map((lng) => (
                    <Badge key={lng}>{lng}</Badge>
                  ))}
                </div>
              </div>

              <div className="settings-localization-sources__item-header">
                <div className="settings-localization-sources__item-header-info">
                  <Badge>
                    {source.type === "builtin"
                      ? t("localization:localization_source_builtin")
                      : t("localization:localization_source_updated")}
                  </Badge>
                  {source.type === "builtin" && (
                    <span className="settings-localization-sources__synced-at">
                      {t("localization:localization_source_auto_update")}
                    </span>
                  )}
                  {source.type === "json" && source.syncedAt && (
                    <span className="settings-localization-sources__synced-at">
                      {new Date(source.syncedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>
                <CheckboxField
                  label=""
                  aria-label={source.name}
                  checked={source.enabled}
                  onChange={() => handleToggle(source)}
                />
              </div>

              {gamesCount > 0 && (
                <button
                  type="button"
                  className="settings-localization-sources__games-link"
                  onClick={() => openGamesModal(source)}
                >
                  {t("localization:localization_source_games", {
                    count: gamesCount,
                  })}
                </button>
              )}

              {source.type === "json" && (
                <TextField
                  label={t("localization:localization_source_url")}
                  value={source.url ?? ""}
                  readOnly
                  theme="dark"
                  disabled
                  rightContent={
                    <Button
                      type="button"
                      theme="outline"
                      onClick={() => handleRemove(source)}
                    >
                      <NoEntryIcon />
                      {t("localization:remove_localization_source")}
                    </Button>
                  }
                />
              )}

              {source.type === "builtin" && source.url && (
                <TextField
                  label={t("localization:localization_source_url")}
                  value={source.url}
                  readOnly
                  theme="dark"
                  disabled
                  rightContent={
                    <Button
                      type="button"
                      theme="outline"
                      onClick={() =>
                        window.electron.openExternal(source.url as string)
                      }
                    >
                      <LinkExternalIcon />
                      {t("localization:localization_source_open")}
                    </Button>
                  }
                />
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
