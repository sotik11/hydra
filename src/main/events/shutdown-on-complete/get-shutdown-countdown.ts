import { registerEvent } from "../register-event";
import { getShutdownCountdownRemaining } from "@main/services/download/shutdown-on-complete";

const getShutdownCountdown = (
  _event: Electron.IpcMainInvokeEvent
): number | null => {
  return getShutdownCountdownRemaining();
};

registerEvent("getShutdownCountdown", getShutdownCountdown);
