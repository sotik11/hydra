import fs from "node:fs";
import path from "node:path";
import { app } from "electron";
import axios from "axios";
import { registerEvent } from "../register-event";
import { logger } from "@main/services";

const PREFIX = {
  banner: "local-profile-banner-",
  avatar: "local-profile-avatar-",
} as const;

type ProfileImageKind = keyof typeof PREFIX;

const extFromUrl = (url: string): string => {
  const clean = url.split("?")[0];
  const ext = path.extname(clean);
  return ext && ext.length <= 5 ? ext : ".webp";
};

/**
 * Fork subscription-transition migration (Cloud → local mirror). While the user
 * is subscribed we download their current Hydra Cloud banner/avatar into
 * userData and reuse it as the local fallback once the subscription lapses (so
 * the local image is the last Cloud one, without having to catch the exact
 * expiry moment). Shares the local-profile-{kind}- prefix and clear-then-write
 * cleanup with save-local-profile-{banner,avatar}, so only one file per kind
 * ever lives on disk. Returns the stable local path.
 */
const mirrorRemoteProfileImage = async (
  _event: Electron.IpcMainInvokeEvent,
  kind: ProfileImageKind,
  url: string
): Promise<string | null> => {
  const prefix = PREFIX[kind];
  const userDataPath = app.getPath("userData");

  try {
    const response = await axios.get<ArrayBuffer>(url, {
      responseType: "arraybuffer",
    });

    for (const file of fs.readdirSync(userDataPath)) {
      if (file.startsWith(prefix)) {
        fs.rmSync(path.join(userDataPath, file), { force: true });
      }
    }

    const destPath = path.join(
      userDataPath,
      `${prefix}${Date.now()}${extFromUrl(url)}`
    );

    fs.writeFileSync(destPath, Buffer.from(response.data));

    return destPath;
  } catch (err) {
    logger.warn(`Failed to mirror remote ${kind}`, err);
    return null;
  }
};

registerEvent("mirrorRemoteProfileImage", mirrorRemoteProfileImage);
