import { useContext, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircleFillIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CopyIcon,
  DownloadIcon,
  KeyIcon,
  LinkExternalIcon,
  XCircleIcon,
} from "@primer/octicons-react";

import {
  Badge,
  Button,
  CheckboxField,
  Modal,
  ProgressBar,
  TextField,
} from "@renderer/components";
import { gameDetailsContext } from "@renderer/context";
import { useToast } from "@renderer/hooks";
import { formatBytes, formatBytesToMbps, sanitizeHtml } from "@shared";
import type { GameLocalization, LocalizationDownloadProgress } from "@types";

import steamStoreIcon from "./store-icons/steam.png";
import epicStoreIcon from "./store-icons/epic.png";
import gogStoreIcon from "./store-icons/gog.png";

import "./localizations-modal.scss";
import "./download-settings-modal.scss";
import "./localization-i18n";

export interface LocalizationsModalProps {
  visible: boolean;
  onClose: () => void;
}

type LocalizationAvailability = "online" | "partial" | "offline";

// fallback "works with" stores when a localization doesn't declare its own
const DEFAULT_STORES = [
  { name: "Steam", iconUrl: steamStoreIcon },
  { name: "Epic Games Store", iconUrl: epicStoreIcon },
  { name: "GOG", iconUrl: gogStoreIcon },
];

// "in development" badge in the localization's own language, not the UI locale
// (a Czech translation says it in Czech); unmapped languages fall back to the UI string
const IN_DEV_BY_LANG: Record<string, string> = {
  Русский: "В РАЗРАБОТКЕ!",
  English: "IN DEVELOPMENT!",
  Українська: "В РОЗРОБЦІ!",
  Čeština: "PŘEKLAD PROBÍHÁ!",
  Slovenčina: "PREKLAD PREBIEHA!",
  Magyar: "FORDÍTÁS FOLYAMATBAN!",
  Polski: "W TRAKCIE TŁUMACZENIA!",
};

export function LocalizationsModal({
  visible,
  onClose,
}: Readonly<LocalizationsModalProps>) {
  const { shop, objectId, gameTitle } = useContext(gameDetailsContext);

  const { t } = useTranslation("game_details");
  const { showSuccessToast } = useToast();

  const copyArchivePassword = (password: string) => {
    void navigator.clipboard.writeText(password);
    showSuccessToast(t("localization:localization_archive_password_copied"));
  };

  // "In development" in the localization's own language (content language).
  const inDevLabel = (language: string) =>
    IN_DEV_BY_LANG[language] ?? t("localization:localization_in_development");

  const [isSearching, setIsSearching] = useState(false);
  const [localizations, setLocalizations] = useState<GameLocalization[]>([]);
  const [howToInstallHtml, setHowToInstallHtml] = useState<string | null>(null);

  const [downloadsPath, setDownloadsPath] = useState("");
  const [autoExtract, setAutoExtract] = useState(false);
  const [deleteArchive, setDeleteArchive] = useState(false);
  const [openChangelogHtml, setOpenChangelogHtml] = useState<string | null>(
    null
  );
  const [openAuthorsHtml, setOpenAuthorsHtml] = useState<string | null>(null);
  const [download, setDownload] = useState<LocalizationDownloadProgress | null>(
    null
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStudios, setSelectedStudios] = useState<string[]>([]);
  const [isFilterDrawerOpen, setIsFilterDrawerOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    window.electron.getDefaultDownloadsPath().then(setDownloadsPath);
    const unsubscribe =
      window.electron.onLocalizationDownloadProgress(setDownload);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!visible || !objectId) return;

    let cancelled = false;
    setIsSearching(true);

    window.electron
      .searchLocalizations(shop, objectId, gameTitle)
      .then((results) => {
        if (!cancelled) setLocalizations(results);
      })
      .catch(() => {
        if (!cancelled) setLocalizations([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [visible, shop, objectId, gameTitle]);

  useEffect(() => {
    if (!visible) {
      setSearchTerm("");
      setSelectedStudios([]);
      setIsFilterDrawerOpen(false);
      setSelectedIndex(null);
    }
  }, [visible]);

  const uniqueStudios = useMemo(
    () => Array.from(new Set(localizations.map((item) => item.studio))),
    [localizations]
  );

  const filteredLocalizations = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return localizations.filter((item) => {
      const matchesTerm =
        !term ||
        item.studio.toLowerCase().includes(term) ||
        item.title.toLowerCase().includes(term);
      const matchesStudio =
        selectedStudios.length === 0 || selectedStudios.includes(item.studio);

      return matchesTerm && matchesStudio;
    });
  }, [localizations, searchTerm, selectedStudios]);

  const selectedLocalization =
    selectedIndex !== null ? (localizations[selectedIndex] ?? null) : null;

  // don't let an outside click close the modal mid-download — you'd lose sight of the
  // progress (it keeps running). close via X / Cancel instead.
  const isSelectedDownloading =
    selectedLocalization !== null &&
    download?.studio === selectedLocalization.studio &&
    (download?.status === "active" || download?.status === "extracting");

  const toggleStudio = (studio: string) => {
    setSelectedStudios((prev) =>
      prev.includes(studio)
        ? prev.filter((item) => item !== studio)
        : [...prev, studio]
    );
  };

  const getAvailability = (
    localization: GameLocalization
  ): LocalizationAvailability => {
    if (localization.directAvailable) return "online";
    const hasCloudMirror = localization.mirrors.some(
      (mirror) => mirror.kind !== "direct"
    );
    return hasCloudMirror ? "partial" : "offline";
  };

  const renderContentBadges = (localization: GameLocalization) => {
    const includedContents = [
      localization.hasVoice && t("localization:localization_voice"),
      localization.hasText && t("localization:localization_text"),
      localization.hasTextures && t("localization:localization_textures"),
      localization.hasSongs && t("localization:localization_songs"),
      localization.hasNeuralVoice &&
        t("localization:localization_neural_voice"),
      localization.hasNeuralDub && t("localization:localization_neural_dub"),
      localization.hasNeuralText && t("localization:localization_neural_text"),
    ].filter((label): label is string => Boolean(label));

    return includedContents.map((label) => <Badge key={label}>{label}</Badge>);
  };

  // prepend "v" only if the version doesn't already have one (avoid "vv0.85")
  const formatVersion = (v: string) =>
    /^v/i.test(v.trim()) ? v.trim() : `v${v.trim()}`;

  const renderVersionDate = (localization: GameLocalization) => {
    const parts: string[] = [];
    if (localization.version) parts.push(formatVersion(localization.version));
    if (localization.updatedAt)
      parts.push(
        t("localization:localization_updated_at", {
          date: localization.updatedAt,
        })
      );
    if (localization.size) parts.push(localization.size);

    return parts.join(" · ");
  };

  const renderCardVersionDate = (localization: GameLocalization) => {
    const parts: string[] = [];
    if (localization.version) parts.push(formatVersion(localization.version));
    if (localization.updatedAt) parts.push(localization.updatedAt);
    if (localization.size) parts.push(localization.size);

    return parts.join(" · ");
  };

  const handleDirectDownload = (localization: GameLocalization) => {
    const direct = localization.mirrors.find(
      (mirror) => mirror.kind === "direct"
    );
    if (!direct || !downloadsPath) return;

    window.electron.startLocalizationDownload(
      localization.studio,
      direct.url,
      downloadsPath,
      autoExtract,
      deleteArchive
    );
  };

  const handleChoosePath = async () => {
    const { filePaths } = await window.electron.showOpenDialog({
      defaultPath: downloadsPath,
      properties: ["openDirectory"],
    });
    if (filePaths && filePaths.length > 0) {
      setDownloadsPath(filePaths[0]);
    }
  };

  const renderDownloadStatus = (progress: LocalizationDownloadProgress) => {
    if (progress.status === "active") {
      return (
        <div className="localizations-modal__download">
          <ProgressBar
            now={progress.progress * 100}
            max={100}
            label={`${Math.round(progress.progress * 100)}%`}
            completed={false}
            trackClassName="localizations-modal__progress-track"
            barClassName="localizations-modal__progress-bar"
          />
          <div className="localizations-modal__download-info">
            <span>
              {Math.round(progress.progress * 100)}% ·{" "}
              {formatBytes(progress.bytesDownloaded)} /{" "}
              {formatBytes(progress.fileSize)} ·{" "}
              {formatBytesToMbps(progress.downloadSpeed)}
            </span>
            <button
              type="button"
              className="localizations-modal__cancel-download"
              onClick={() => window.electron.cancelLocalizationDownload()}
            >
              <XCircleIcon size={14} />
              {t("cancel")}
            </button>
          </div>
        </div>
      );
    }

    if (progress.status === "extracting") {
      return (
        <div className="localizations-modal__download">
          <span className="localizations-modal__download-info">
            {t("localization:localization_extracting")}
          </span>
        </div>
      );
    }

    if (progress.status === "complete") {
      return (
        <div className="localizations-modal__download localizations-modal__download--complete">
          <span>{t("localization:localization_download_complete")}</span>
          {progress.filePath && (
            <button
              type="button"
              className="localizations-modal__open-folder"
              onClick={() =>
                window.electron.showItemInFolder(progress.filePath!)
              }
            >
              {t("localization:localization_open_folder")}
            </button>
          )}
        </div>
      );
    }

    if (progress.status === "error") {
      return (
        <div className="localizations-modal__download localizations-modal__download--error">
          {t("localization:localization_download_error")}
        </div>
      );
    }

    return null;
  };

  const renderDetail = (localization: GameLocalization) => {
    const activeDownload =
      download?.studio === localization.studio ? download : null;
    const isBusy =
      activeDownload?.status === "active" ||
      activeDownload?.status === "extracting";
    const hasCloudMirror = localization.mirrors.some(
      (mirror) => mirror.kind !== "direct"
    );
    const hasWorkingDownload = localization.directAvailable || hasCloudMirror;
    // no working direct link = no in-app download (mirrors are browser-only),
    // so the extract/delete checkboxes get cleared and locked
    const canDirectDownload = localization.directAvailable && !isBusy;

    // keep a short required version (1.50.0+) or "Any" inline in the header; move long
    // per-store build lists to their own row so they don't stretch the window
    const requiredVersion = localization.requiredGameVersion ?? "";
    const requiredVersionHasDigit = /\d/.test(requiredVersion);
    const requiredVersionInline =
      requiredVersion.length > 0 &&
      (!requiredVersionHasDigit || requiredVersion.length <= 10);
    const requiredVersionBlock =
      requiredVersionHasDigit && requiredVersion.length > 10;

    return (
      <div className="localizations-modal__detail">
        <div className="localizations-modal__card-header">
          <p className="localizations-modal__meta">{localization.title}</p>
          <span className="localizations-modal__language">
            {localization.language}
          </span>
        </div>

        <div className="localizations-modal__badges">
          {renderContentBadges(localization)}
        </div>

        {renderVersionDate(localization) && (
          <p className="localizations-modal__version-date">
            {renderVersionDate(localization)}
          </p>
        )}

        {localization.inDevelopment && (
          <span className="localizations-modal__in-development">
            {inDevLabel(localization.language)}
          </span>
        )}

        <div className="localizations-modal__links">
          <button
            type="button"
            className="localizations-modal__how-to-install"
            onClick={() =>
              setHowToInstallHtml(
                localization.howToInstallHtml ||
                  t("localization:localization_default_install_guide")
              )
            }
          >
            {t("localization:localization_how_to_install")}
          </button>
          {localization.changelogHtml && (
            <button
              type="button"
              className="localizations-modal__how-to-install"
              onClick={() => setOpenChangelogHtml(localization.changelogHtml)}
            >
              {t("localization:localization_changelog")}
            </button>
          )}
          {localization.authorsHtml && (
            <button
              type="button"
              className="localizations-modal__how-to-install"
              onClick={() => setOpenAuthorsHtml(localization.authorsHtml)}
            >
              {t("localization:localization_authors")}
            </button>
          )}
        </div>
        <div className="localizations-modal__spacer" />

        <div className="localizations-modal__stores">
          <span className="localizations-modal__stores-label">
            {t("localization:localization_supported_stores")}
            {requiredVersionInline
              ? ` (${localization.requiredGameVersion})`
              : ""}
            :
          </span>
          {requiredVersionBlock && (
            <span className="localizations-modal__stores-version">
              ({localization.requiredGameVersion})
            </span>
          )}
          <div className="localizations-modal__stores-list">
            {localization.stores.length > 0
              ? localization.stores.map((store) => (
                  <button
                    key={store.url}
                    type="button"
                    className="localizations-modal__store"
                    title={store.name}
                    aria-label={store.name}
                    onClick={() => window.electron.openExternal(store.url)}
                  >
                    <img
                      src={store.iconUrl}
                      alt={store.name}
                      className="localizations-modal__store-icon"
                    />
                  </button>
                ))
              : DEFAULT_STORES.map((store) => (
                  <span
                    key={store.name}
                    className="localizations-modal__store localizations-modal__store--default"
                    title={store.name}
                  >
                    <img
                      src={store.iconUrl}
                      alt={store.name}
                      className="localizations-modal__store-icon"
                    />
                  </span>
                ))}
          </div>
        </div>

        <hr className="localizations-modal__divider" />

        {localization.archivePassword && (
          <div className="localizations-modal__archive-password">
            <span className="localizations-modal__archive-password-label">
              <KeyIcon />
              {t("localization:localization_archive_password")}
            </span>
            <code className="localizations-modal__archive-password-value">
              {localization.archivePassword}
            </code>
            <button
              type="button"
              className="localizations-modal__archive-password-copy"
              onClick={() => copyArchivePassword(localization.archivePassword!)}
              aria-label={t(
                "localization:localization_archive_password_copy_label"
              )}
            >
              <CopyIcon />
            </button>
          </div>
        )}

        <span className="localizations-modal__downloader-label">
          {t("downloader")}
        </span>

        <div className="localizations-modal__download-list">
          <div
            className="localizations-modal__download-row localizations-modal__download-row--direct"
            title={
              localization.directAvailable
                ? undefined
                : t("localization:localization_direct_unavailable")
            }
          >
            <span className="localizations-modal__download-row-label">
              <DownloadIcon />
              {t("localization:localization_direct_download")}
            </span>
            <span className="localizations-modal__download-row-indicators">
              {localization.size && (
                <span className="localizations-modal__download-row-size">
                  {localization.size}
                </span>
              )}
              <span
                className={`download-settings-modal__availability-indicator ${
                  localization.directAvailable
                    ? "download-settings-modal__availability-indicator--available download-settings-modal__availability-indicator--pulsating"
                    : "download-settings-modal__availability-indicator--unavailable"
                }`}
              />
              {localization.directAvailable && (
                <CheckCircleFillIcon size={16} />
              )}
            </span>
          </div>

          {localization.mirrors
            .filter(
              (mirror) =>
                mirror.kind !== "direct" && mirror.url !== localization.pageUrl
            )
            .map((mirror) => (
              <button
                key={mirror.url}
                type="button"
                className="localizations-modal__download-row"
                onClick={() => window.electron.openExternal(mirror.url)}
              >
                <span className="localizations-modal__download-row-label">
                  <LinkExternalIcon />
                  {mirror.label}
                </span>
              </button>
            ))}

          <button
            type="button"
            className="localizations-modal__download-row localizations-modal__download-row--browser"
            onClick={() => window.electron.openExternal(localization.pageUrl)}
          >
            <span className="localizations-modal__download-row-label">
              <LinkExternalIcon />
              {t("localization:localization_open_in_browser")}
            </span>
          </button>
        </div>

        {!hasWorkingDownload && (
          <div className="localizations-modal__no-download">
            {t("localization:localization_no_working_link")}
          </div>
        )}

        <div className="download-settings-modal__downloads-path-field">
          <TextField
            value={downloadsPath}
            readOnly
            disabled
            label={t("download_path")}
            rightContent={
              <Button
                type="button"
                theme="outline"
                onClick={handleChoosePath}
                disabled={!canDirectDownload}
              >
                {t("change")}
              </Button>
            }
          />
        </div>

        <CheckboxField
          label={t("automatically_extract_downloaded_files")}
          checked={canDirectDownload && autoExtract}
          disabled={!canDirectDownload}
          onChange={() => setAutoExtract(!autoExtract)}
        />

        <CheckboxField
          label={t("delete_archive_files_after_extraction")}
          checked={canDirectDownload && deleteArchive}
          disabled={!canDirectDownload}
          onChange={() => setDeleteArchive(!deleteArchive)}
        />

        <Button
          type="button"
          onClick={() => handleDirectDownload(localization)}
          disabled={!canDirectDownload}
        >
          <DownloadIcon />
          {t("download_now")}
        </Button>

        {activeDownload && renderDownloadStatus(activeDownload)}
      </div>
    );
  };

  const renderList = () => {
    if (isSearching) {
      return (
        <div className="localizations-modal__status">
          {t("localization:localization_searching")}
        </div>
      );
    }

    if (filteredLocalizations.length === 0) {
      return (
        <div className="localizations-modal__status">
          {t("localization:no_localizations_found")}
        </div>
      );
    }

    return filteredLocalizations.map((localization) => {
      const realIndex = localizations.indexOf(localization);
      const availability = getAvailability(localization);

      return (
        <Button
          key={`${localization.studio}-${realIndex}`}
          theme="dark"
          className="localizations-modal__card-button"
          onClick={() => setSelectedIndex(realIndex)}
        >
          <span
            className={`localizations-modal__availability-orb localizations-modal__availability-orb--${availability}`}
          />

          <p className="localizations-modal__card-title">
            {localization.title}
            <span className="localizations-modal__language">
              {localization.language}
            </span>
          </p>

          {/* On the list card, only flag "in development" when there's nothing
              to grab yet. If a (direct or cloud) link exists, stay quiet here so
              the card isn't dismissed — the detail view still shows the flag, and
              a partial translation beats nothing. */}
          {localization.inDevelopment && localization.mirrors.length === 0 && (
            <span className="localizations-modal__in-development">
              {t("localization:localization_in_development")}
            </span>
          )}

          <div className="localizations-modal__badges">
            {renderContentBadges(localization)}
          </div>

          <p className="localizations-modal__card-info">
            {localization.studio}
          </p>
          {renderCardVersionDate(localization) && (
            <p className="localizations-modal__version-date">
              {renderCardVersionDate(localization)}
            </p>
          )}
        </Button>
      );
    });
  };

  return (
    <>
      <Modal
        visible={visible}
        title={t("localization:localizations_modal_title")}
        description={t("localization:localizations_modal_description")}
        onClose={onClose}
        className="localizations-modal__window"
      >
        {localizations.length > 0 && (
          <div className="localizations-modal__filter-container">
            <div className="localizations-modal__filter-top">
              <TextField
                placeholder={t("localization:localization_search")}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
              {uniqueStudios.length > 1 && (
                <Button
                  type="button"
                  theme="outline"
                  className="localizations-modal__filter-toggle"
                  onClick={() => setIsFilterDrawerOpen(!isFilterDrawerOpen)}
                >
                  {t("localization:localization_filter_by_studio")}
                  {isFilterDrawerOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                </Button>
              )}
            </div>

            <div
              className={`localizations-modal__studios-drawer ${
                isFilterDrawerOpen
                  ? "localizations-modal__studios-drawer--open"
                  : ""
              }`}
            >
              <div className="localizations-modal__studio-grid">
                {uniqueStudios.map((studio) => (
                  <div
                    key={studio}
                    className="localizations-modal__studio-item"
                  >
                    <CheckboxField
                      label={studio}
                      checked={selectedStudios.includes(studio)}
                      onChange={() => toggleStudio(studio)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="localizations-modal__list">{renderList()}</div>
      </Modal>

      <Modal
        visible={selectedLocalization !== null}
        title={
          selectedLocalization ? (
            <button
              type="button"
              className="localizations-modal__studio-link"
              onClick={() =>
                window.electron.openExternal(selectedLocalization.studioUrl)
              }
            >
              {selectedLocalization.studio}
            </button>
          ) : (
            ""
          )
        }
        onClose={() => setSelectedIndex(null)}
        className="localizations-modal__window"
        clickOutsideToClose={!isSelectedDownloading}
      >
        {selectedLocalization && renderDetail(selectedLocalization)}
      </Modal>

      <Modal
        visible={howToInstallHtml !== null}
        title={t("localization:localization_how_to_install")}
        onClose={() => setHowToInstallHtml(null)}
        className="localizations-modal__window"
      >
        <div
          className="localizations-modal__instructions"
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(howToInstallHtml ?? ""),
          }}
        />
      </Modal>

      <Modal
        visible={openChangelogHtml !== null}
        title={t("localization:localization_changelog")}
        onClose={() => setOpenChangelogHtml(null)}
        className="localizations-modal__window"
      >
        <div
          className="localizations-modal__instructions localizations-modal__changelog"
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(openChangelogHtml ?? ""),
          }}
        />
      </Modal>

      <Modal
        visible={openAuthorsHtml !== null}
        title={t("localization:localization_authors")}
        onClose={() => setOpenAuthorsHtml(null)}
        className="localizations-modal__window"
      >
        <div
          className="localizations-modal__instructions localizations-modal__authors"
          dangerouslySetInnerHTML={{
            __html: sanitizeHtml(openAuthorsHtml ?? ""),
          }}
        />
      </Modal>
    </>
  );
}
