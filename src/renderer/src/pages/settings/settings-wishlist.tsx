import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, TextField } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import {
  CheckCircleFillIcon,
  ChevronRightIcon,
  LinkExternalIcon,
  SyncIcon,
} from "@primer/octicons-react";

import type { SteamWishlistState } from "@types";
import steamLogo from "@renderer/assets/icons/steam.png";

import "./settings-debrid.scss";
import "./settings-retroachievements.scss";
import "./settings-wishlist.scss";
import "./wishlist-i18n";

const STATUS_ICON_SIZE = 14;
const CHEVRON_ICON_SIZE = 16;

const STEAM_API_KEY_URL = "https://steamcommunity.com/dev/apikey";

const emptyState: SteamWishlistState = {
  connected: false,
  profile: null,
  items: [],
  syncedAt: null,
  hasApiKey: false,
  libraryCount: null,
};

export function SettingsWishlist() {
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();
  const { t } = useTranslation("wishlist");

  const [state, setState] = useState<SteamWishlistState>(emptyState);
  const [profileInput, setProfileInput] = useState("");
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(
    () => !userPreferences?.steamWishlistSteamId
  );

  useEffect(() => {
    let active = true;

    window.electron
      .getSteamWishlist()
      .then((status) => {
        if (active) setState(status);
      })
      .catch(() => {
        if (active) setState(emptyState);
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const persistState = async (
    status: SteamWishlistState,
    apiKey: string | null
  ) => {
    await updateUserPreferences({
      steamWishlistSteamId: status.profile?.steamId64 ?? null,
      steamWishlistPersonaName: status.profile?.personaName ?? null,
      steamWishlistAvatarUrl: status.profile?.avatarUrl ?? null,
      steamWishlistSyncedAt: status.syncedAt,
      steamWishlistApiKey: apiKey,
      steamWishlistLibraryCount: status.libraryCount,
    }).catch(() => {});
  };

  const handleConnect: React.FormEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault();
    setIsSubmitting(true);

    const key = apiKeyInput.trim() || null;

    try {
      const status = await window.electron.connectSteamWishlist(
        profileInput.trim(),
        key
      );
      setState(status);
      setAvatarError(false);
      await persistState(status, key);
      showSuccessToast(t("wishlist_connected"));
    } catch {
      showErrorToast(t("wishlist_connect_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      const status = await window.electron.refreshSteamWishlist();
      setState(status);
      setAvatarError(false);
      await persistState(status, userPreferences?.steamWishlistApiKey ?? null);
      showSuccessToast(t("wishlist_updated"));
    } catch {
      showErrorToast(t("wishlist_connect_error"));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSubmitting(true);

    try {
      await window.electron.disconnectSteamWishlist();
      setState(emptyState);
      setProfileInput("");
      setApiKeyInput("");
      await updateUserPreferences({
        steamWishlistSteamId: null,
        steamWishlistPersonaName: null,
        steamWishlistAvatarUrl: null,
        steamWishlistSyncedAt: null,
        steamWishlistApiKey: null,
        steamWishlistLibraryCount: null,
      }).catch(() => {});
      showSuccessToast(t("wishlist_disconnected"));
    } catch {
      showErrorToast(t("wishlist_connect_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <p className="settings-retroachievements__description">
          {t("wishlist_loading")}
        </p>
      );
    }

    if (state.connected && state.profile) {
      const profileUrl = `https://steamcommunity.com/profiles/${state.profile.steamId64}`;

      return (
        <div className="settings-retroachievements__connected">
          <div className="settings-retroachievements__profile">
            <div className="settings-wishlist__avatar">
              {state.profile.avatarUrl && !avatarError ? (
                <img
                  src={state.profile.avatarUrl}
                  alt={state.profile.personaName}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <img src={steamLogo} alt="Steam" />
              )}
            </div>

            <div className="settings-retroachievements__account">
              <span className="settings-retroachievements__username">
                {state.profile.personaName}
              </span>
              <button
                type="button"
                className="settings-wishlist__profile-link"
                onClick={() => window.electron.openExternal(profileUrl)}
              >
                <LinkExternalIcon size={12} />
                {t("wishlist_open_profile")}
              </button>
              <span className="settings-retroachievements__status">
                <CheckCircleFillIcon size={STATUS_ICON_SIZE} />
                {t("wishlist_status_wishlist", { count: state.items.length })}
              </span>
              {state.libraryCount != null && (
                <span className="settings-retroachievements__status">
                  <CheckCircleFillIcon size={STATUS_ICON_SIZE} />
                  {t("wishlist_status_library", { count: state.libraryCount })}
                </span>
              )}
            </div>
          </div>

          <div className="settings-retroachievements__actions">
            <Button
              theme="outline"
              onClick={handleRefresh}
              disabled={isRefreshing || isSubmitting}
            >
              <SyncIcon size={STATUS_ICON_SIZE} />
              {t("wishlist_update")}
            </Button>
            <Button
              theme="danger"
              onClick={handleDisconnect}
              disabled={isSubmitting || isRefreshing}
            >
              {t("wishlist_disconnect")}
            </Button>
          </div>
        </div>
      );
    }

    // Connect stage — mirror the RA form: left-aligned text, full-width fields,
    // Connect button bottom-right, no avatar.
    return (
      <form
        className="settings-retroachievements__form"
        onSubmit={handleConnect}
      >
        <div className="settings-retroachievements__description-container">
          <p className="settings-retroachievements__description">
            {t("wishlist_description")}
          </p>
          <p className="settings-retroachievements__emulator-note">
            {t("wishlist_privacy_note")}
          </p>
        </div>

        <TextField
          label={t("wishlist_profile_label")}
          value={profileInput}
          onChange={(event) => setProfileInput(event.target.value)}
          placeholder={t("wishlist_profile_placeholder")}
        />

        <TextField
          label={t("wishlist_api_key_label")}
          value={apiKeyInput}
          type="password"
          onChange={(event) => setApiKeyInput(event.target.value)}
          placeholder={t("wishlist_api_key_placeholder")}
          hint={
            <button
              type="button"
              className="settings-wishlist__profile-link"
              onClick={() => window.electron.openExternal(STEAM_API_KEY_URL)}
            >
              <LinkExternalIcon size={12} />
              {t("wishlist_api_key_hint")}
            </button>
          }
        />

        <Button
          type="submit"
          className="settings-retroachievements__submit-button"
          disabled={!profileInput.trim() || isSubmitting}
        >
          {t("wishlist_connect")}
        </Button>
      </form>
    );
  };

  return (
    <div
      className={`settings-debrid__section ${
        isCollapsed ? "" : "settings-debrid__section--expanded"
      }`}
    >
      <div className="settings-debrid__section-header">
        <button
          type="button"
          className="settings-debrid__collapse-button"
          onClick={() => setIsCollapsed((prev) => !prev)}
          aria-label={
            isCollapsed ? t("wishlist_expand") : t("wishlist_collapse")
          }
        >
          <span
            className={`settings-debrid__collapse-icon ${
              isCollapsed ? "" : "settings-debrid__collapse-icon--expanded"
            }`}
          >
            <ChevronRightIcon size={CHEVRON_ICON_SIZE} />
          </span>
        </button>
        <h3 className="settings-debrid__section-title">
          {t("wishlist_title")}
        </h3>
        <img
          src={steamLogo}
          alt=""
          className="settings-retroachievements__title-logo"
        />
        {state.connected && (
          <CheckCircleFillIcon
            size={CHEVRON_ICON_SIZE}
            className="settings-debrid__check-icon"
          />
        )}
      </div>

      {!isCollapsed && renderBody()}
    </div>
  );
}
