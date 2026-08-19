import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import { registerEvent } from "../register-event";
import { logger } from "@main/services";

const LOCAL_BANNER_PREFIX = "local-profile-banner-";

/**
 * Fork "local profile banner": the cropped banner comes back as a temp file
 * (see crop-profile-image), which the OS may clear. Copy it into userData so it
 * survives restarts, and return the stable path. No Hydra Cloud upload involved.
 * Old local banners are removed first so they don't pile up.
 */
const saveLocalProfileBanner = async (
  _event: Electron.IpcMainInvokeEvent,
  sourcePath: string
): Promise<string> => {
  const userDataPath = app.getPath("userData");

  try {
    for (const file of fs.readdirSync(userDataPath)) {
      if (file.startsWith(LOCAL_BANNER_PREFIX)) {
        fs.rmSync(path.join(userDataPath, file), { force: true });
      }
    }
  } catch (err) {
    logger.error("Failed to clear old local banners", err);
  }

  const ext = path.extname(sourcePath) || ".webp";
  const destPath = path.join(
    userDataPath,
    `${LOCAL_BANNER_PREFIX}${Date.now()}${ext}`
  );

  fs.copyFileSync(sourcePath, destPath);

  return destPath;
};

registerEvent("saveLocalProfileBanner", saveLocalProfileBanner);
