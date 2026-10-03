import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircleFillIcon, LinkExternalIcon } from "@primer/octicons-react";

import { useLibrary } from "@renderer/hooks";
import type { SteamWishlistSummary } from "@types";

import "./wishlist-i18n";
import "./steam-card-extras.scss";

interface SteamCardExtrasProps {
  steamId64: string;
}

// Fork: extra lines for upstream's Steam integration card — profile link, the
// Steam wishlist pulled through the same session, and how many imported games
// are in the library.
export function SteamCardExtras({ steamId64 }: Readonly<SteamCardExtrasProps>) {
  const { t } = useTranslation("wishlist");
  const { library } = useLibrary();
  const [wishlist, setWishlist] = useState<SteamWishlistSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    const apply = (summary: SteamWishlistSummary | null) => {
      if (!cancelled && summary) setWishlist(summary);
    };

    window.electron
      .getSteamWishlist()
      .then(apply)
      .catch(() => {});

    // The wishlist is refreshed right after every successful Steam sync (the
    // refresh is deduplicated in the main process).
    const unsubscribe = window.electron.onSteamSyncFinished((payload) => {
      if (!payload.ok || !payload.status.connected) return;
      window.electron
        .refreshSteamWishlist()
        .then(apply)
        .catch(() => {});
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const importedCount = useMemo(
    () => library.filter((game) => game.hasActiveSteamImport).length,
    [library]
  );

  const profileUrl = `https://steamcommunity.com/profiles/${steamId64}`;

  return (
    <div className="steam-card-extras">
      <button
        type="button"
        className="steam-card-extras__link"
        onClick={() => window.electron.openExternal(profileUrl)}
      >
        <LinkExternalIcon size={12} />
        {t("wishlist_open_profile")}
      </button>

      {wishlist?.count != null && (
        <span className="steam-card-extras__line">
          <CheckCircleFillIcon size={12} />
          {t("wishlist_status_wishlist", { count: wishlist.count })}
        </span>
      )}

      {importedCount > 0 && (
        <span className="steam-card-extras__line">
          <CheckCircleFillIcon size={12} />
          {t("wishlist_status_library", { count: importedCount })}
        </span>
      )}
    </div>
  );
}
