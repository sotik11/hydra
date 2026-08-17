import { useContext, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, TextField } from "@renderer/components";
import { useAppSelector, useToast } from "@renderer/hooks";
import { settingsContext } from "@renderer/context";
import {
  CheckCircleFillIcon,
  ChevronRightIcon,
  LinkExternalIcon,
  PersonIcon,
  SyncIcon,
} from "@primer/octicons-react";

import type { NexusModsState } from "@types";
import NexusLogo from "@renderer/assets/icons/nexus.svg?react";

import "./settings-debrid.scss";
import "./settings-retroachievements.scss";
import "./settings-wishlist.scss";
import "./mods-i18n";

const STATUS_ICON_SIZE = 14;
const CHEVRON_ICON_SIZE = 16;

const NEXUS_API_KEY_URL = "https://next.nexusmods.com/settings/api-keys";

const emptyState: NexusModsState = {
  connected: false,
  profile: null,
  connectedAt: null,
  matchedCount: null,
};

export function SettingsMods() {
  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );
  const { updateUserPreferences } = useContext(settingsContext);
  const { showSuccessToast, showErrorToast } = useToast();
  const { t } = useTranslation("mods");

  const [state, setState] = useState<NexusModsState>(emptyState);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [avatarError, setAvatarError] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(
    () => !userPreferences?.nexusApiKey
  );

  useEffect(() => {
    let active = true;

    window.electron
      .getNexusMods()
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
    status: NexusModsState,
    apiKey: string | null
  ) => {
    await updateUserPreferences({
      nexusApiKey: apiKey,
      nexusUserId: status.profile?.userId ?? null,
      nexusUserName: status.profile?.name ?? null,
      nexusAvatarUrl: status.profile?.avatarUrl ?? null,
      nexusIsPremium: status.profile?.isPremium ?? null,
      nexusConnectedAt: status.connectedAt,
    }).catch(() => {});
  };

  const handleConnect: React.FormEventHandler<HTMLFormElement> = async (
    event
  ) => {
    event.preventDefault();
    setIsSubmitting(true);

    const key = apiKeyInput.trim();

    try {
      const status = await window.electron.connectNexusMods(key);
      setState(status);
      setAvatarError(false);
      await persistState(status, key);
      showSuccessToast(t("mods_connected"));
    } catch {
      showErrorToast(t("mods_connect_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);

    try {
      const status = await window.electron.refreshNexusMods();
      setState(status);
      setAvatarError(false);
      await persistState(status, userPreferences?.nexusApiKey ?? null);
      showSuccessToast(t("mods_updated"));
    } catch {
      showErrorToast(t("mods_connect_error"));
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDisconnect = async () => {
    setIsSubmitting(true);

    try {
      await window.electron.disconnectNexusMods();
      setState(emptyState);
      setApiKeyInput("");
      await updateUserPreferences({
        nexusApiKey: null,
        nexusUserId: null,
        nexusUserName: null,
        nexusAvatarUrl: null,
        nexusIsPremium: null,
        nexusConnectedAt: null,
      }).catch(() => {});
      showSuccessToast(t("mods_disconnected"));
    } catch {
      showErrorToast(t("mods_connect_error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <p className="settings-retroachievements__description">
          {t("mods_loading")}
        </p>
      );
    }

    if (state.connected && state.profile) {
      const profileUrl = `https://www.nexusmods.com/users/${state.profile.userId}`;

      return (
        <div className="settings-retroachievements__connected">
          <div className="settings-retroachievements__profile">
            <div className="settings-wishlist__avatar">
              {state.profile.avatarUrl && !avatarError ? (
                <img
                  src={state.profile.avatarUrl}
                  alt={state.profile.name}
                  onError={() => setAvatarError(true)}
                />
              ) : (
                <PersonIcon size={24} />
              )}
            </div>

            <div className="settings-retroachievements__account">
              <span className="settings-retroachievements__username">
                {state.profile.name}
              </span>
              <button
                type="button"
                className="settings-wishlist__profile-link"
                onClick={() => window.electron.openExternal(profileUrl)}
              >
                <LinkExternalIcon size={12} />
                {t("mods_open_profile")}
              </button>
              <span className="settings-retroachievements__status">
                <CheckCircleFillIcon size={STATUS_ICON_SIZE} />
                {t("mods_status_connected")}
              </span>
              <span className="settings-retroachievements__status">
                <CheckCircleFillIcon size={STATUS_ICON_SIZE} />
                {state.profile.isPremium
                  ? t("mods_status_premium")
                  : t("mods_status_free")}
              </span>
              {state.matchedCount != null && (
                <span className="settings-retroachievements__status">
                  <CheckCircleFillIcon size={STATUS_ICON_SIZE} />
                  {t("mods_status_matched", { count: state.matchedCount })}
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
              {t("mods_update")}
            </Button>
            <Button
              theme="danger"
              onClick={handleDisconnect}
              disabled={isSubmitting || isRefreshing}
            >
              {t("mods_disconnect")}
            </Button>
          </div>
        </div>
      );
    }

    // Connect stage — mirror the wishlist/RA form: left-aligned text, full-width
    // key field, Connect button bottom-right.
    return (
      <form
        className="settings-retroachievements__form"
        onSubmit={handleConnect}
      >
        <div className="settings-retroachievements__description-container">
          <p className="settings-retroachievements__description">
            {t("mods_description")}
          </p>
          <p className="settings-retroachievements__emulator-note">
            {t("mods_privacy_note")}
          </p>
        </div>

        <TextField
          label={t("mods_api_key_label")}
          value={apiKeyInput}
          type="password"
          onChange={(event) => setApiKeyInput(event.target.value)}
          placeholder={t("mods_api_key_placeholder")}
          hint={
            <button
              type="button"
              className="settings-wishlist__profile-link"
              onClick={() => window.electron.openExternal(NEXUS_API_KEY_URL)}
            >
              <LinkExternalIcon size={12} />
              {t("mods_api_key_hint")}
            </button>
          }
        />

        <Button
          type="submit"
          className="settings-retroachievements__submit-button"
          disabled={!apiKeyInput.trim() || isSubmitting}
        >
          {t("mods_connect")}
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
          aria-label={isCollapsed ? t("mods_expand") : t("mods_collapse")}
        >
          <span
            className={`settings-debrid__collapse-icon ${
              isCollapsed ? "" : "settings-debrid__collapse-icon--expanded"
            }`}
          >
            <ChevronRightIcon size={CHEVRON_ICON_SIZE} />
          </span>
        </button>
        <h3 className="settings-debrid__section-title">{t("mods_title")}</h3>
        <NexusLogo
          className="settings-retroachievements__title-logo"
          aria-hidden="true"
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
