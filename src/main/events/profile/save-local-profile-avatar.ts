import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { registerEvent } from "../register-event";
import { logger } from "@main/services";

const LOCAL_AVATAR_PREFIX = "local-profile-avatar-";

/**
 * Fork "local animated avatar": the cropped avatar comes back as a temp file
 * (see crop-profile-image, which preserves animation), which the OS may clear.
 * Copy it into userData so it survives restarts, and return the stable path. No
 * Hydra Cloud upload — the server downscales GIF avatars to a static frame for
 * non-subscribers. Old local avatars are removed first so they don't pile up.
 */
const saveLocalProfileAvatar = async (
  _event: Electron.IpcMainInvokeEvent,
  sourcePath: string
): Promise<string> => {
  const userDataPath = app.getPath("userData");

  try {
    for (const file of fs.readdirSync(userDataPath)) {
      if (file.startsWith(LOCAL_AVATAR_PREFIX)) {
        fs.rmSync(path.join(userDataPath, file), { force: true });
      }
    }
  } catch (err) {
    logger.error("Failed to clear old local avatars", err);
  }

  const ext = path.extname(sourcePath) || ".webp";
  const destPath = path.join(
    userDataPath,
    `${LOCAL_AVATAR_PREFIX}${Date.now()}${ext}`
  );

  fs.copyFileSync(sourcePath, destPath);

  return destPath;
};

registerEvent("saveLocalProfileAvatar", saveLocalProfileAvatar);
