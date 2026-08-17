import type { GameShop } from "@types";
import { WindowManager } from "../window-manager";
import { logger } from "../logger";
import { executeSystemShutdown } from "@main/helpers/system-power";

// Cancelable grace period before the machine actually powers off.
export const SHUTDOWN_COUNTDOWN_SECONDS = 60;

// Per-download "shut down when this finishes" flags, kept in memory and keyed by
// `${shop}:${objectId}`. Session-scoped on purpose: downloads don't auto-resume
// across restarts, so a stale flag would be surprising. Because only one
// download is active at a time, the flag of the download that actually completes
// is the one that decides.
const flags = new Map<string, boolean>();

const buildKey = (shop: GameShop, objectId: string) => `${shop}:${objectId}`;

export function setShutdownOnComplete(
  shop: GameShop,
  objectId: string,
  enabled: boolean
) {
  const key = buildKey(shop, objectId);
  if (enabled) flags.set(key, true);
  else flags.delete(key);
}

export function getShutdownOnComplete(
  shop: GameShop,
  objectId: string
): boolean {
  return flags.get(buildKey(shop, objectId)) ?? false;
}

let shutdownTimer: NodeJS.Timeout | null = null;
// Absolute deadline (ms epoch) so a freshly (re)created window can pull the
// remaining time on mount — the toast push alone is lost if the window is being
// recreated from the tray when the countdown starts.
let shutdownDeadline: number | null = null;

/** Seconds left on the active countdown, or null if none is running. */
export function getShutdownCountdownRemaining(): number | null {
  if (shutdownTimer === null || shutdownDeadline === null) return null;
  const remainingMs = shutdownDeadline - Date.now();
  if (remainingMs <= 0) return null;
  return Math.ceil(remainingMs / 1000);
}

/**
 * Start the cancelable shutdown countdown (no-op if one is already running).
 * Notifies the renderer so it can show a toast with a cancel button.
 */
export function startShutdownCountdown() {
  if (shutdownTimer) return;

  logger.info("[shutdown-on-complete] scheduling shutdown", {
    seconds: SHUTDOWN_COUNTDOWN_SECONDS,
  });

  shutdownDeadline = Date.now() + SHUTDOWN_COUNTDOWN_SECONDS * 1000;

  // The countdown toast lives in the main window's renderer, so if the window is
  // hidden in the tray or minimized (the default close action), it wouldn't be
  // seen — yet the machine would still power off. Bring the window back to the
  // front first. Closing to the tray actually destroys the window, so this may
  // recreate it; the renderer then pulls the remaining time on mount (see
  // getShutdownCountdownRemaining) since this push would arrive before it loads.
  WindowManager.openMainWindow();

  WindowManager.sendToAppWindows("on-shutdown-scheduled", {
    seconds: SHUTDOWN_COUNTDOWN_SECONDS,
  });

  shutdownTimer = setTimeout(() => {
    shutdownTimer = null;
    shutdownDeadline = null;
    executeSystemShutdown();
  }, SHUTDOWN_COUNTDOWN_SECONDS * 1000);
}

/** Cancel a pending shutdown countdown, if any. */
export function cancelScheduledShutdown() {
  if (!shutdownTimer) return;

  clearTimeout(shutdownTimer);
  shutdownTimer = null;
  shutdownDeadline = null;

  logger.info("[shutdown-on-complete] shutdown cancelled");
  WindowManager.sendToAppWindows("on-shutdown-cancelled");
}

/**
 * Called when a download finishes: if that download had the flag on, consume it
 * and kick off the shutdown countdown.
 */
export function handleShutdownOnDownloadComplete(
  shop: GameShop,
  objectId: string
) {
  const key = buildKey(shop, objectId);
  if (!flags.get(key)) return;

  flags.delete(key);
  startShutdownCountdown();
}
