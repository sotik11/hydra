import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircleFillIcon,
  LinkExternalIcon,
  PersonIcon,
} from "@primer/octicons-react";

import { useLibrary } from "@renderer/hooks";
import type { EpicConnectedConnection, SteamIntegrationStatus } from "@types";

import "./wishlist-i18n";
import "./steam-card-extras.scss";

const EPIC_PROFILE_URL = "https://store.epicgames.com/u/";
const STEAM_INTEGRATION_ENDPOINT = "/profile/integrations/steam";

// Fork: Epic's connection carries no avatar yet. Use one if Epic ever sends it,
// otherwise borrow the connected Steam avatar, otherwise the plain person icon.
export function EpicCardAvatar({
  connection,
  size,
}: Readonly<{ connection: EpicConnectedConnection; size: number }>) {
  const epicAvatarUrl =
    (connection as EpicConnectedConnection & { avatarUrl?: string | null })
      .avatarUrl ?? null;
  const [steamAvatarUrl, setSteamAvatarUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    if (epicAvatarUrl) return;
    let cancelled = false;
    globalThis.window.electron.hydraApi
      .get<SteamIntegrationStatus>(STEAM_INTEGRATION_ENDPOINT)
      .then((status) => {
        const account =
          status.connected || status.snapshotPreserved ? status : null;
        if (!cancelled) setSteamAvatarUrl(account?.avatarUrl ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [epicAvatarUrl]);

  const avatarUrl = epicAvatarUrl ?? steamAvatarUrl;

  return avatarUrl && failed !== avatarUrl ? (
    <img
      src={avatarUrl}
      alt={connection.displayName}
      onError={() => setFailed(avatarUrl)}
    />
  ) : (
    <PersonIcon size={size} />
  );
}

// Fork: extra lines for upstream's Epic integration card — profile link and how
// many Epic games are in the library (Epic has no public wishlist API).
export function EpicCardExtras({
  epicAccountId,
}: Readonly<{ epicAccountId: string }>) {
  const { t } = useTranslation("wishlist");
  const { library } = useLibrary();

  const importedCount = useMemo(
    () => library.filter((game) => game.hasActiveEpicImport).length,
    [library]
  );

  return (
    <div className="steam-card-extras">
      <button
        type="button"
        className="steam-card-extras__link"
        onClick={() =>
          window.electron.openExternal(`${EPIC_PROFILE_URL}${epicAccountId}`)
        }
      >
        <LinkExternalIcon size={12} />
        {t("wishlist_open_profile")}
      </button>

      {importedCount > 0 && (
        <span className="steam-card-extras__line">
          <CheckCircleFillIcon size={12} />
          {t("wishlist_status_library", { count: importedCount })}
        </span>
      )}
    </div>
  );
}
