import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { DownloadIcon } from "@primer/octicons-react";

import achievementSound from "@renderer/assets/audio/achievement.wav";
import "./wishlist-page-i18n";
import "./wishlist-available-notification.scss";

interface AvailableToast {
  id: number;
  appId: string;
  title: string;
}

const DISMISS_MS = 8000;

/**
 * Global listener for "a wishlisted game got a repack" events from the main
 * process. Shows a one-off toast (own icon + achievement sound) stacked at the
 * bottom-right. Clicking a toast opens the game page. Mounted once, next to the
 * achievement overlay.
 */
export function WishlistAvailableNotification() {
  const { t } = useTranslation("wishlist");
  const navigate = useNavigate();
  const [toasts, setToasts] = useState<AvailableToast[]>([]);
  const nextId = useRef(1);

  useEffect(() => {
    const unsubscribe = window.electron.onWishlistGameAvailable((payload) => {
      const id = nextId.current++;
      setToasts((prev) => [
        ...prev,
        { id, appId: payload.appId, title: payload.title },
      ]);

      try {
        void new Audio(achievementSound).play();
      } catch {
        // audio is best-effort
      }

      window.setTimeout(() => {
        setToasts((prev) => prev.filter((toast) => toast.id !== id));
      }, DISMISS_MS);
    });

    return unsubscribe;
  }, []);

  const dismiss = (id: number) =>
    setToasts((prev) => prev.filter((toast) => toast.id !== id));

  const open = (toast: AvailableToast) => {
    dismiss(toast.id);
    navigate(`/game/steam/${toast.appId}`);
  };

  if (toasts.length === 0) return null;

  return (
    <div className="wishlist-available">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="wishlist-available__toast"
          onClick={() => open(toast)}
        >
          <span className="wishlist-available__icon">
            <DownloadIcon size={20} />
          </span>
          <span className="wishlist-available__text">
            {t("available_toast", { game: toast.title })}
          </span>
        </button>
      ))}
    </div>
  );
}
