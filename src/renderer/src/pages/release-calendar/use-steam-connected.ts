import { useCallback, useEffect, useState } from "react";
import { useUserDetails } from "@renderer/hooks";
import { logger } from "@renderer/logger";
import type { SteamIntegrationStatus } from "@types";

const STEAM_INTEGRATION_ENDPOINT = "/profile/integrations/steam";

/**
 * Whether the Steam integration (Settings → Integrations → Steam) is connected.
 * null while unknown. Re-checked when Steam gets connected and when the window
 * regains focus (disconnect has no event of its own).
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
    const unsubscribe = globalThis.window.electron.onSteamConnected(() => {
      void check();
    });
    const onFocus = () => void check();
    globalThis.window.addEventListener("focus", onFocus);
    return () => {
      unsubscribe();
      globalThis.window.removeEventListener("focus", onFocus);
    };
  }, [check]);

  return connected;
}
