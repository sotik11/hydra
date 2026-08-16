import { exec } from "node:child_process";
import { logger } from "@main/services/logger";

// Best-effort OS shutdown. Windows works out of the box; on Linux/macOS it may
// require privileges (systemctl/logind usually allows the desktop user).
export function executeSystemShutdown(): void {
  let command: string;

  switch (process.platform) {
    case "win32":
      command = "shutdown /s /t 0";
      break;
    case "darwin":
      command =
        "osascript -e 'tell application \"System Events\" to shut down'";
      break;
    default:
      command = "systemctl poweroff || shutdown -h now";
      break;
  }

  logger.info("[system-power] executing shutdown", { command });

  exec(command, (error) => {
    if (error) {
      logger.error("[system-power] shutdown failed", error);
    }
  });
}
