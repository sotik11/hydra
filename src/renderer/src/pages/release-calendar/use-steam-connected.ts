import { useCallback, useEffect, useState } from "react";
import { useUserDetails } from "@renderer/hooks";
import { logger } from "@renderer/logger";
import type { SteamIntegrationStatus } from "@types";

const STEAM_INTEGRATION_ENDPOINT = "/profile/integrations/steam";

/**
 * Whether the Steam integration (Settings → Integrations → Steam) is connected.
 * null while unknown. Re-checked when Steam gets connected or disconnected and
 * when the window regains focus.
 */
export function useSteamConnected(): boolean | null {
  const { userDetails } = useUserDetails();
  const [connected, setConnected] = useState<boolean | null>(null);

  const check = useCallback(async () => {
    if (!userDetails) {
      setConnected(false);
      return;
    }
    try {
      const status =
        await globalThis.window.electron.hydraApi.get<SteamIntegrationStatus>(
          STEAM_INTEGRATION_ENDPOINT
        );
      setConnected(status.connected);
    } catch (error) {
      logger.error("[release-calendar] Steam integration status failed", error);
      setConnected(false);
    }
  }, [userDetails]);

  useEffect(() => {
    void check();
    const unsubscribeConnected = globalThis.window.electron.onSteamConnected(
      () => {
        void check();
      }
    );
    const unsubscribeDisconnected =
      globalThis.window.electron.onSteamDisconnected(() => {
        setConnected(false);
      });
    const onFocus = () => void check();
    globalThis.window.addEventListener("focus", onFocus);
    return () => {
      unsubscribeConnected();
      unsubscribeDisconnected();
      globalThis.window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  return connected;
}
