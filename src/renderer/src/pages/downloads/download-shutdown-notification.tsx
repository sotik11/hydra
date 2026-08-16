import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { XCircleIcon } from "@primer/octicons-react";

import "./shutdown-i18n";
import "./download-shutdown-notification.scss";

/**
 * Global listener for the "shutting down after download" countdown from the main
 * process. Shows a bottom-centre toast with a live countdown and a cancel
 * button. Mounted once, next to the other global overlays.
 */
export function DownloadShutdownNotification() {
  const { t } = useTranslation("shutdown");
  const [remaining, setRemaining] = useState<number | null>(null);
  const intervalRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    const unsubscribeScheduled = window.electron.onShutdownScheduled(
      ({ seconds }) => {
        clearTimer();
        setRemaining(seconds);
        intervalRef.current = window.setInterval(() => {
          setRemaining((prev) => {
            if (prev === null) return null;
            if (prev <= 1) {
              clearTimer();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    );

    const unsubscribeCancelled = window.electron.onShutdownCancelled(() => {
      clearTimer();
      setRemaining(null);
    });

    return () => {
      unsubscribeScheduled();
      unsubscribeCancelled();
      clearTimer();
    };
  }, []);

  const handleCancel = () => {
    clearTimer();
    setRemaining(null);
    void window.electron.cancelDownloadShutdown();
  };

  if (remaining === null) return null;

  return (
    <div className="download-shutdown">
      <span className="download-shutdown__text">
        {t("shutdown_scheduled", { seconds: remaining })}
      </span>
      <button
        type="button"
        className="download-shutdown__cancel"
        onClick={handleCancel}
      >
        <XCircleIcon size={14} />
        {t("shutdown_cancel")}
      </button>
    </div>
  );
}
