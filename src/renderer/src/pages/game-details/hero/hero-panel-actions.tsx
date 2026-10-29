import {
  DownloadIcon,
  FileIcon,
  GearIcon,
  GlobeIcon,
  HeartFillIcon,
  HeartIcon,
  PinIcon,
  PinSlashIcon,
  PlayIcon,
  PlusCircleIcon,
  StarIcon,
  StarFillIcon,
  XIcon,
} from "@primer/octicons-react";
import { Button, ConfirmationModal, Modal } from "@renderer/components";
import type { LibraryGame, NexusMatch } from "@types";
import {
  canRetryEpicLaunchWithLocalSaves,
  getEpicLaunchError,
  getEpicManagedError,
} from "@renderer/helpers/epic-managed-error";
import { FileArchive, XCircle, Puzzle } from "lucide-react";
import { ModsModal } from "../modals/mods-modal";
import {
  useAppSelector,
  useDownload,
  useGameExecutablePicker,
  useFinishedDownloadStep,
  useLibrary,
  useToast,
  useUserDetails,
} from "@renderer/hooks";
import { useEpicManagedConnection } from "@renderer/hooks/use-epic-managed";
import { useEpicGameUpdate } from "@renderer/hooks/use-epic-game-update";
import { useCallback, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { gameDetailsContext } from "@renderer/context";
import { logger } from "@renderer/logger";
import {
  canDownloadOnSteam,
  handleClassicsLaunchError,
} from "@renderer/helpers";
import { SteamIcon } from "@renderer/components/steam-library-badge/steam-library-badge";
import EpicLogo from "@renderer/assets/epic-integration-logo.svg?react";
import { DiscSelectionModal } from "../modals/disc-selection-modal";
import { EpicCloudSaveConflictModal } from "../modals/epic-cloud-save-conflict-modal";

import "./hero-panel-actions.scss";
import "./hero-panel-actions-fork.scss";
import { useEffect } from "react";
import {
  applyLibraryGroupAction,
  isEpicMemberInCurrentScope,
  isEpicUpdateInterrupted,
  isLibraryGameDownloading,
  getEpicLaunchOptions,
  getEpicMemberDownload,
  getOfficialStoreMembers,
} from "@shared";
import "../modals/localization-i18n";
import "@renderer/pages/wishlist/wishlist-page-i18n";
import "@renderer/pages/settings/mods-i18n";

export function HeroPanelActions() {
  const [toggleLibraryGameDisabled, setToggleLibraryGameDisabled] =
    useState(false);
  const [addedToWishlist, setAddedToWishlist] = useState(false);
  const [showRemoveFromLibrary, setShowRemoveFromLibrary] = useState(false);
  const [nexusMatch, setNexusMatch] = useState<NexusMatch | null>(null);
  const [showModsModal, setShowModsModal] = useState(false);

  const {
    isGameDeleting,
    lastPacket,
    resumeDownload,
    removeGameFromLibrary,
    cancelDownload,
  } = useDownload();
  const { userDetails } = useUserDetails();

  const {
    game,
    downloadGame,
    presentation,
    repacks,
    isGameRunning,
    shop,
    objectId,
    gameTitle,
    shopDetails,
    setShowGameOptionsModal,
    setGameOptionsInitialCategory,
    setShowRepacksModal,
    setShowLocalizationsModal,
    updateGame,
    selectGameExecutable,
    isTransferring,
    transferProgress,
  } = useContext(gameDetailsContext);

  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const localizationsEnabled = userPreferences?.localizationsEnabled ?? true;

  const isGameDownloading = isLibraryGameDownloading(downloadGame);
  const { installationAvailable: epicInstallationAvailable, connection } =
    useEpicManagedConnection();
  const epicDownload =
    game?.shop === "epic" ? getEpicMemberDownload(game, downloadGame) : null;
  const epicUpdate = useEpicGameUpdate(
    game,
    epicInstallationAvailable && isEpicMemberInCurrentScope(game, connection),
    epicDownload?.status
  );
  const epicUpdateInterrupted =
    !!epicDownload && isEpicUpdateInterrupted(epicDownload);

  const pickGameExecutable = useGameExecutablePicker();
  const finishedDownloadStep = useFinishedDownloadStep(downloadGame);

  const { updateLibrary } = useLibrary();

  const { showSuccessToast, showErrorToast } = useToast();

  const navigate = useNavigate();
  const location = useLocation();

  const [showDiscSelectionModal, setShowDiscSelectionModal] = useState(false);

  useEffect(() => {
    const state = (location.state as Record<string, unknown> | null) ?? {};
    if (!state.openDiscSelection) return;
    if (game?.shop !== "launchbox" || (game?.discs?.length ?? 0) <= 1) return;

    setShowDiscSelectionModal(true);
    navigate(location.pathname + location.search, { replace: true, state: {} });
  }, [location, game?.shop, game?.discs?.length, navigate]);
  const [localSaveRetry, setLocalSaveRetry] = useState<{
    member: LibraryGame;
    skipUpdateCheck: boolean;
  } | null>(null);
  const [epicSaveConflict, setEpicSaveConflict] = useState<LibraryGame | null>(
    null
  );
  const [canRetryOffline, setCanRetryOffline] = useState(false);
  const [canRetryLocalSaves, setCanRetryLocalSaves] = useState(false);
  const officialMembers = getOfficialStoreMembers(
    presentation?.members ?? (game ? [game] : [])
  );
  const [pendingClassicsLaunch, setPendingClassicsLaunch] = useState<{
    discPath: string | undefined;
  } | null>(null);

  const { t } = useTranslation("game_details");
  const launchGeneration = useRef(0);
  const invalidateLaunch = useCallback(() => {
    launchGeneration.current++;
  }, []);
  useEffect(() => {
    const invalidate = () => {
      invalidateLaunch();
      setLocalSaveRetry(null);
      setEpicSaveConflict(null);
    };
    invalidate();
    const stop = window.electron?.onEpicConnectionChanged?.(invalidate);
    return () => {
      invalidateLaunch();
      stop?.();
    };
  }, [shop, objectId, invalidateLaunch]);

  useEffect(() => {
    const onOpenDiscSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ objectId?: string }>).detail;
      if (!detail?.objectId || detail.objectId === game?.objectId) {
        if (game?.shop === "launchbox" && (game?.discs?.length ?? 0) > 1) {
          setShowDiscSelectionModal(true);
        }
      }
    };
    window.addEventListener(
      "hydra:openDiscSelection",
      onOpenDiscSelection as EventListener
    );
    return () => {
      window.removeEventListener(
        "hydra:openDiscSelection",
        onOpenDiscSelection as EventListener
      );
    };
  }, [game?.objectId, game?.shop, game?.discs?.length]);

  useEffect(() => {
    const onFavoriteToggled = () => {
      updateLibrary();
      updateGame();
    };

    const onGameRemoved = () => {
      updateLibrary();
      updateGame();
    };

    const onFilesRemoved = () => {
      updateLibrary();
      updateGame();
    };

    window.addEventListener(
      "hydra:game-favorite-toggled",
      onFavoriteToggled as EventListener
    );
    window.addEventListener(
      "hydra:game-removed-from-library",
      onGameRemoved as EventListener
    );
    window.addEventListener(
      "hydra:game-files-removed",
      onFilesRemoved as EventListener
    );

    return () => {
      window.removeEventListener(
        "hydra:game-favorite-toggled",
        onFavoriteToggled as EventListener
      );
      window.removeEventListener(
        "hydra:game-removed-from-library",
        onGameRemoved as EventListener
      );
      window.removeEventListener(
        "hydra:game-files-removed",
        onFilesRemoved as EventListener
      );
    };
  }, [updateLibrary, updateGame]);

  const addGameToLibrary = async () => {
    setToggleLibraryGameDisabled(true);

    try {
      await window.electron.addGameToLibrary(
        shop,
        objectId!,
        gameTitle,
        shopDetails?.platform ?? null
      );

      updateLibrary();
      updateGame();
    } finally {
      setToggleLibraryGameDisabled(false);
    }
  };

  const toggleGameFavorite = async () => {
    setToggleLibraryGameDisabled(true);

    try {
      if (!game) return;
      const favorite = presentation?.favorite ?? game.favorite;
      await applyLibraryGroupAction(
        presentation?.members ?? [game],
        (member) =>
          favorite
            ? window.electron.removeGameFromFavorites(
                member.shop,
                member.objectId
              )
            : window.electron.addGameToFavorites(member.shop, member.objectId)
      );
      showSuccessToast(
        t(favorite ? "game_removed_from_favorites" : "game_added_to_favorites")
      );
    } catch {
      showErrorToast(t("failed_update_favorites"));
    } finally {
      await Promise.all([updateLibrary(), updateGame()]);
      setToggleLibraryGameDisabled(false);
    }
  };

  const toggleGamePinned = async () => {
    setToggleLibraryGameDisabled(true);

    try {
      if (!game) return;
      const pinned = presentation?.isPinned ?? game.isPinned;
      await applyLibraryGroupAction(presentation?.members ?? [game], (member) =>
        window.electron.toggleGamePin(member.shop, member.objectId, !pinned)
      );
      showSuccessToast(
        t(pinned ? "game_removed_from_pinned" : "game_added_to_pinned")
      );
    } catch {
      showErrorToast(t("failed_update_pinned"));
    } finally {
      await Promise.all([updateLibrary(), updateGame()]);
      setToggleLibraryGameDisabled(false);
    }
  };

  const launchClassicsWithErrorHandling = async (
    discPath?: string,
    force?: boolean
  ): Promise<void> => {
    if (!game) return;
    try {
      await window.electron.openClassicsGame(
        game.shop,
        game.objectId,
        discPath,
        force
      );
    } catch (error) {
      handleClassicsLaunchError(error, {
        t,
        showErrorToast,
        showSuccessToast,
        navigate,
        onEmulatorAlreadyRunning: () => setPendingClassicsLaunch({ discPath }),
      });
    }
  };

  const openClassicsGame = async () => {
    if (!game) return;

    const discs = game.discs ?? [];

    if (
      discs.length === 0 ||
      (discs.length === 1 && game.selectedDiscPath !== null)
    ) {
      await launchClassicsWithErrorHandling();
      return;
    }

    if (game.dontAskDiscSelection && game.selectedDiscPath) {
      await launchClassicsWithErrorHandling(game.selectedDiscPath);
      return;
    }

    setShowDiscSelectionModal(true);
  };

  const handleDiscSelectionConfirm = async (
    discPath: string,
    dontAskAgain: boolean
  ) => {
    if (!game) return;
    setShowDiscSelectionModal(false);
    try {
      await window.electron.updateClassicsDisc(game.shop, game.objectId, {
        selectedDiscPath: discPath,
        dontAskDiscSelection: dontAskAgain,
      });
      updateGame();
    } catch (error) {
      // non-fatal; still try to launch
    }
    await launchClassicsWithErrorHandling(discPath);
  };

  const openGame = async () => {
    if (!game) return;

    if (game.shop === "launchbox") {
      await openClassicsGame();
      return;
    }

    if (game.executablePath) {
      await launchMember(game);
      return;
    }

    const gameExecutablePath = await selectGameExecutable();
    if (gameExecutablePath)
      window.electron.openGame(
        game.shop,
        game.objectId,
        gameExecutablePath,
        game.launchOptions
      );
  };
  const launchMember = async (
    member: LibraryGame,
    localOnce = false,
    offline = false,
    skipUpdateCheck = false
  ) => {
    if (!member.executablePath) return;
    setLocalSaveRetry(null);
    setEpicSaveConflict(null);
    setCanRetryOffline(false);
    setCanRetryLocalSaves(false);
    const generation = launchGeneration.current;
    try {
      await window.electron.openGame(
        member.shop,
        member.objectId,
        member.executablePath,
        member.launchOptions,
        getEpicLaunchOptions(localOnce, offline, skipUpdateCheck)
      );
    } catch (error) {
      if (generation !== launchGeneration.current) return;
      const code =
        member.shop === "epic" ? getEpicLaunchError(error) : undefined;
      if (code === "save-conflict") {
        setEpicSaveConflict(member);
        return;
      }
      if (code === "update-required") void epicUpdate.refresh(true);
      const translation = code ? getEpicManagedError(code) : null;
      showErrorToast(
        translation
          ? t(translation.key, { ns: translation.ns })
          : t("epic_launch_failed")
      );
      if (
        member.shop === "epic" &&
        typeof window.electron.getEpicCloudSaveState === "function"
      ) {
        const state = await window.electron
          .getEpicCloudSaveState(member.objectId)
          .catch(() => null);
        if (generation !== launchGeneration.current) return;
        if (state?.status === "conflict") {
          setEpicSaveConflict(member);
          return;
        }
        if (
          canRetryEpicLaunchWithLocalSaves(state) ||
          state?.canRunOffline === true
        ) {
          setLocalSaveRetry({ member, skipUpdateCheck });
          setCanRetryOffline(state?.canRunOffline === true);
          setCanRetryLocalSaves(canRetryEpicLaunchWithLocalSaves(state));
        }
      }
    }
  };

  const startEpicUpdate = async (resume = false) => {
    const result = await epicUpdate.start(lastPacket !== null, resume);
    if (result.ok) {
      await Promise.all([updateLibrary(), updateGame()]);
      return;
    }
    const translation = getEpicManagedError(result.error);
    showErrorToast(
      t("epic_update_failed"),
      t(translation.key, { ns: translation.ns })
    );
  };

  const resumeEpicUpdate = async () => {
    if (!game) return;
    if (epicDownload?.status !== "paused" && epicDownload?.status !== "error") {
      await startEpicUpdate(true);
      return;
    }
    try {
      const resumed = await resumeDownload(
        game.shop,
        game.objectId,
        "queueIfActive"
      );
      if (resumed === false) showErrorToast(t("epic_update_failed"));
    } catch {
      showErrorToast(t("epic_update_failed"));
      await updateLibrary();
    }
    await updateGame();
  };

  const closeGame = () => {
    if (game) window.electron.closeGame(game.shop, game.objectId);
  };

  const deleting = game ? isGameDeleting(game?.id) : false;

  const addGameToLibraryButton = (
    <Button
      theme="outline"
      disabled={toggleLibraryGameDisabled}
      onClick={addGameToLibrary}
      className="hero-panel-actions__action"
    >
      <PlusCircleIcon />
      {t("add_to_library")}
    </Button>
  );

  const showDownloadOptionsButton = (
    <Button
      onClick={() => setShowRepacksModal(true)}
      theme="outline"
      disabled={deleting}
      className="hero-panel-actions__action"
    >
      {t("open_download_options")}
    </Button>
  );

  const localizationButton = localizationsEnabled ? (
    <Button
      onClick={() => setShowLocalizationsModal(true)}
      theme="outline"
      disabled={deleting}
      className="hero-panel-actions__action"
    >
      <GlobeIcon />
      {t("localization:localization")}
    </Button>
  ) : null;

  // Fork: "Mods" button — only when the game matched a Nexus game with mods.
  const modsButton = nexusMatch ? (
    <Button
      onClick={() => setShowModsModal(true)}
      theme="outline"
      disabled={deleting}
      className="hero-panel-actions__action"
    >
      <Puzzle size={16} />
      {t("mods:mods_button")}
    </Button>
  ) : null;

  useEffect(() => {
    if (!objectId) {
      setNexusMatch(null);
      return;
    }
    let active = true;
    window.electron
      .getNexusMatchForGame(shop, objectId)
      .then((match) => {
        if (active) setNexusMatch(match);
      })
      .catch(() => {
        if (active) setNexusMatch(null);
      });
    return () => {
      active = false;
    };
  }, [shop, objectId]);

  useEffect(() => {
    if (!objectId) return;
    let active = true;
    window.electron
      .getWishlistGames()
      .then((games) => {
        if (active) {
          setAddedToWishlist(games.some((g) => g.appId === objectId));
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [objectId]);

  const toggleWishlist = async () => {
    if (!objectId) return;
    try {
      if (addedToWishlist) {
        await window.electron.removeWishlistGame(objectId);
        setAddedToWishlist(false);
      } else {
        await window.electron.addWishlistGame(objectId);
        setAddedToWishlist(true);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const wishlistButton =
    shop === "steam" ? (
      <Button
        onClick={toggleWishlist}
        theme="outline"
        className="hero-panel-actions__action"
      >
        {addedToWishlist ? <StarFillIcon /> : <StarIcon />}
        {addedToWishlist
          ? t("remove_from_wishlist", { ns: "wishlist" })
          : t("add_to_wishlist", { ns: "wishlist" })}
      </Button>
    ) : null;

  const handleRemoveFromLibrary = async () => {
    if (!objectId) return;
    try {
      if (isGameDownloading) {
        await cancelDownload(shop, objectId);
      }
      await removeGameFromLibrary(shop, objectId);
      await Promise.all([updateLibrary(), updateGame()]);
      showSuccessToast(t("game_removed_from_library"));
    } catch (error) {
      showErrorToast(t("failed_remove_from_library"));
      console.error(error);
    }
  };

  // Opens the game's Steam store page in the browser. Shown for Steam games in
  // every layout (in library or not).
  const steamButton =
    shop === "steam" ? (
      <Button
        onClick={() =>
          window.electron.openExternal(
            `https://store.steampowered.com/app/${objectId}`
          )
        }
        theme="outline"
        disabled={deleting}
        className="hero-panel-actions__action"
        title={t("open_in_steam", { ns: "wishlist" })}
      >
        <SteamIcon size={16} />
      </Button>
    ) : null;

  // Fork: the game's Epic Games Store page — for an Epic game, or a game grouped
  // with an Epic copy. The slug is resolved in main (storefront GraphQL); without
  // one the store search by title opens instead.
  const epicStoreObjectId =
    shop === "epic" ? objectId : (officialMembers.epic?.objectId ?? null);
  const epicStoreButton = epicStoreObjectId ? (
    <Button
      onClick={() => {
        window.electron
          .getEpicStorePageUrl(epicStoreObjectId, gameTitle)
          .then((url) => {
            if (url) window.electron.openExternal(url);
          })
          .catch(() => {});
      }}
      theme="outline"
      disabled={deleting}
      className="hero-panel-actions__action hero-panel-actions__epic-store"
      title={t("open_in_epic", { ns: "wishlist" })}
    >
      <EpicLogo width={16} height={16} aria-hidden="true" />
    </Button>
  ) : null;

  // In-library layout: no wishlist star (a library game can't be wishlisted).
  // Instead, an X button that mirrors the context-menu "remove from library".
  const removeFromLibraryButton = (
    <Button
      onClick={() => setShowRemoveFromLibrary(true)}
      theme="outline"
      disabled={deleting}
      className="hero-panel-actions__action"
      title={t("remove_from_library")}
    >
      <XIcon />
    </Button>
  );

  const finishedDownloadButton = () => {
    if (
      !downloadGame ||
      !finishedDownloadStep ||
      finishedDownloadStep === "play"
    ) {
      return null;
    }

    if (finishedDownloadStep === "checking") {
      return (
        <Button theme="outline" disabled className="hero-panel-actions__action">
          {t("checking_files", { ns: "downloads" })}
        </Button>
      );
    }

    if (finishedDownloadStep === "extracting") {
      return (
        <Button theme="outline" disabled className="hero-panel-actions__action">
          {t("extracting")}
        </Button>
      );
    }

    if (finishedDownloadStep === "extract") {
      return (
        <Button
          onClick={async () => {
            await window.electron
              .extractGameDownload(downloadGame.shop, downloadGame.objectId)
              .catch((error) =>
                logger.error("Failed to start extraction", error)
              );
            updateLibrary();
          }}
          theme="outline"
          disabled={deleting}
          className="hero-panel-actions__action"
        >
          <FileArchive size={16} />
          {t("extract", { ns: "downloads" })}
        </Button>
      );
    }

    if (finishedDownloadStep === "installing") {
      return (
        <Button theme="outline" disabled className="hero-panel-actions__action">
          {t("installing", { ns: "downloads" })}
        </Button>
      );
    }

    if (finishedDownloadStep === "install") {
      return (
        <Button
          onClick={async () => {
            const opened = await window.electron
              .openGameInstaller(downloadGame.shop, downloadGame.objectId)
              .catch((error) => {
                logger.error("Failed to open game installer", error);
                return false;
              });

            if (!opened) {
              showErrorToast(t("installer_launch_failed", { ns: "downloads" }));
            }

            updateLibrary();
          }}
          theme="outline"
          disabled={deleting}
          className="hero-panel-actions__action"
        >
          <DownloadIcon />
          {t("install")}
        </Button>
      );
    }

    return (
      <Button
        onClick={async () => {
          const picked = await pickGameExecutable(
            downloadGame.shop,
            downloadGame.objectId
          );

          if (picked) updateGame();
        }}
        theme="outline"
        disabled={deleting}
        className="hero-panel-actions__action"
      >
        <FileIcon size={16} />
        {t("select_executable", { ns: "downloads" })}
      </Button>
    );
  };

  const gameActionButton = () => {
    if (isTransferring) {
      const percent = Math.round(transferProgress * 100);
      return (
        <Button
          theme="outline"
          className="hero-panel-actions__action"
          onClick={() => {
            setGameOptionsInitialCategory("locations");
            setShowGameOptionsModal(true);
          }}
        >
          Transferring {percent}%
        </Button>
      );
    }

    if (isGameRunning) {
      return (
        <Button
          onClick={closeGame}
          theme="outline"
          disabled={deleting}
          className="hero-panel-actions__action"
        >
          <XCircle size={18} />
          {t("close")}
        </Button>
      );
    }

    const isPlayableClassics =
      game?.shop === "launchbox" && (game?.discs?.length ?? 0) > 0;

    if (game?.executablePath && epicDownload?.epic?.update) {
      if (
        isLibraryGameDownloading({ download: epicDownload }) ||
        epicDownload.queued
      )
        return (
          <Button
            theme="outline"
            disabled
            className="hero-panel-actions__action"
          >
            <DownloadIcon />
            {t("epic_updating")}
          </Button>
        );
      if (epicUpdateInterrupted)
        return (
          <Button
            onClick={resumeEpicUpdate}
            theme="outline"
            disabled={deleting || epicUpdate.starting}
            className="hero-panel-actions__action"
          >
            <DownloadIcon />
            {t("epic_update_resume")}
          </Button>
        );
    }

    if (
      game?.executablePath &&
      epicUpdate.update &&
      !isLibraryGameDownloading({ download: epicDownload })
    ) {
      return (
        <>
          <Button
            onClick={() => void startEpicUpdate()}
            theme="outline"
            disabled={deleting || epicUpdate.starting}
            className="hero-panel-actions__action"
            title={t("epic_update_available", {
              version: epicUpdate.update.publishedVersion,
            })}
          >
            <DownloadIcon />
            {t("epic_update")}
          </Button>
          <Button
            onClick={() => {
              if (game) void launchMember(game, false, false, true);
            }}
            theme="outline"
            disabled={deleting || epicUpdate.starting}
            className="hero-panel-actions__action"
          >
            <PlayIcon />
            {t("epic_play_without_update")}
          </Button>
        </>
      );
    }

    if (game?.executablePath || isPlayableClassics) {
      return (
        <Button
          onClick={openGame}
          theme="outline"
          disabled={deleting || isGameRunning}
          className="hero-panel-actions__action"
        >
          <PlayIcon />
          {t("play")}
        </Button>
      );
    }

    const finishedDownloadAction = finishedDownloadButton();
    if (finishedDownloadAction) return finishedDownloadAction;

    return (
      <Button
        onClick={() => setShowRepacksModal(true)}
        theme="outline"
        disabled={isGameDownloading}
        className={`hero-panel-actions__action ${repacks.length === 0 && !canDownloadOnSteam(officialMembers.steam) && !officialMembers.epic ? "hero-panel-actions__action--disabled" : ""}`}
      >
        <DownloadIcon />
        {t("download")}
      </Button>
    );
  };

  if (repacks.length && !game) {
    return (
      <>
        {addGameToLibraryButton}
        {wishlistButton}
        {showDownloadOptionsButton}
        {steamButton}
        {epicStoreButton}
      </>
    );
  }

  if (game) {
    return (
      <div className="hero-panel-actions__container">
        {modsButton}
        {localizationButton}
        <EpicCloudSaveConflictModal
          game={epicSaveConflict}
          isGameRunning={isGameRunning}
          onClose={() => setEpicSaveConflict(null)}
        />
        <Modal
          visible={!!localSaveRetry}
          title={
            canRetryLocalSaves
              ? t("epic_play_local_saves")
              : t("epic_play_offline_title")
          }
          description={
            canRetryLocalSaves
              ? t("epic_play_local_saves_description")
              : t("epic_play_offline_description")
          }
          onClose={() => setLocalSaveRetry(null)}
        >
          <div className="hero-panel-actions__epic-actions">
            {canRetryLocalSaves && (
              <Button
                onClick={() => {
                  if (localSaveRetry)
                    void launchMember(
                      localSaveRetry.member,
                      true,
                      false,
                      localSaveRetry.skipUpdateCheck
                    );
                }}
              >
                {t("epic_play_local_saves")}
              </Button>
            )}
            {canRetryOffline && (
              <Button
                theme="outline"
                onClick={() => {
                  if (localSaveRetry)
                    void launchMember(localSaveRetry.member, false, true);
                }}
              >
                {t("epic_play_offline")}
              </Button>
            )}
          </div>
        </Modal>
        {gameActionButton()}
        <div className="hero-panel-actions__separator" />
        {removeFromLibraryButton}
        <Button
          onClick={toggleGameFavorite}
          theme="outline"
          disabled={deleting}
          className="hero-panel-actions__action"
        >
          {(presentation?.favorite ?? game.favorite) ? (
            <HeartFillIcon />
          ) : (
            <HeartIcon />
          )}
        </Button>

        {userDetails && game.shop !== "custom" && (
          <Button
            onClick={toggleGamePinned}
            theme="outline"
            disabled={deleting}
            className="hero-panel-actions__action"
          >
            {(presentation?.isPinned ?? game.isPinned) ? (
              <PinSlashIcon />
            ) : (
              <PinIcon />
            )}
          </Button>
        )}

        <Button
          onClick={() => {
            setGameOptionsInitialCategory("general");
            setShowGameOptionsModal(true);
          }}
          theme="outline"
          disabled={deleting}
          className="hero-panel-actions__action"
        >
          <GearIcon />
          {t("options")}
        </Button>

        {steamButton}
        {epicStoreButton}

        {game.shop === "launchbox" && (
          <DiscSelectionModal
            visible={showDiscSelectionModal}
            discs={game.discs ?? []}
            defaultDiscPath={game.selectedDiscPath ?? null}
            defaultDontAsk={Boolean(game.dontAskDiscSelection)}
            onClose={() => setShowDiscSelectionModal(false)}
            onConfirm={handleDiscSelectionConfirm}
          />
        )}

        <ConfirmationModal
          visible={pendingClassicsLaunch !== null}
          title={t("rpcs3_already_running_title")}
          descriptionText={t("rpcs3_already_running_description")}
          confirmButtonLabel={t("rpcs3_already_running_confirm")}
          cancelButtonLabel={t("cancel")}
          onClose={() => setPendingClassicsLaunch(null)}
          onConfirm={() => {
            const pending = pendingClassicsLaunch;
            setPendingClassicsLaunch(null);
            if (pending) {
              void launchClassicsWithErrorHandling(pending.discPath, true);
            }
          }}
        />

        <ConfirmationModal
          visible={showRemoveFromLibrary}
          title={t("remove_from_library_title")}
          descriptionText={t("remove_from_library_description", {
            game: gameTitle,
          })}
          confirmButtonLabel={t("remove")}
          cancelButtonLabel={t("cancel")}
          onClose={() => setShowRemoveFromLibrary(false)}
          onConfirm={async () => {
            setShowRemoveFromLibrary(false);
            await handleRemoveFromLibrary();
          }}
        />

        <ModsModal
          visible={showModsModal}
          onClose={() => setShowModsModal(false)}
          match={nexusMatch}
        />
      </div>
    );
  }

  // No repacks and not in the library yet: still offer the wishlist button
  // (next to "add to library") so the game can be tracked for future repacks.
  return (
    <>
      {addGameToLibraryButton}
      {wishlistButton}
      {steamButton}
      {epicStoreButton}
    </>
  );
}
