import fs from "node:fs";
import path from "node:path";

import { SystemPath } from "../system-path";
import { SevenZip } from "../7zip";
import { downloadToFile, removeFileQuietly } from "../download-to-file";
import { logger } from "../logger";
import { detectRetroArchSystemDir } from "./detect-retroarch";

// PPSSPP's libretro core needs its asset bundle (fonts, flash0, atlases) under
// <system>/PPSSPP or it warns "Core system files missing, expect bugs" and some
// UI/dialogs render blank. The .dll core doesn't ship them, so we fetch the
// official libretro assets bundle once, into the user's RetroArch system dir
// (which may be non-standard — resolved from their retroarch.cfg).
const ASSETS_URL = "https://buildbot.libretro.com/assets/system/PPSSPP.zip";

// A file that only exists once the bundle is unpacked → used to skip re-download.
const MARKER = path.join("PPSSPP", "flash0", "font", "jpn0.pgf");

export const ensurePpssppAssets = async (
  executablePath: string
): Promise<boolean> => {
  try {
    const systemDir = detectRetroArchSystemDir(executablePath);
    if (fs.existsSync(path.join(systemDir, MARKER))) {
      logger.info("[ppsspp] assets already present", { systemDir });
      return true;
    }

    await fs.promises.mkdir(systemDir, { recursive: true });
    const archivePath = path.join(
      SystemPath.getPath("temp"),
      "ppsspp-assets.zip"
    );

    logger.info("[ppsspp] downloading assets", { systemDir });
    await downloadToFile(ASSETS_URL, archivePath, () => {});

    // The archive has a top-level "PPSSPP/" folder, so extract into systemDir.
    await SevenZip.extractFile({
      filePath: archivePath,
      outputPath: systemDir,
    });
    await removeFileQuietly(archivePath);

    const ok = fs.existsSync(path.join(systemDir, MARKER));
    logger.info("[ppsspp] assets install result", { systemDir, ok });
    return ok;
  } catch (error) {
    logger.warn("[ppsspp] failed to install assets", { error });
    return false;
  }
};
