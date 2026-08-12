import fs from "node:fs";
import path from "node:path";

import { retroArchConfigRoots } from "./detect-retroarch";
import { logger } from "../logger";

// RetroArch's menu-toggle gamepad combo enum: 4 = Start + Select. Without a
// combo (or a Hotkey Enable button) a controller can't open the Quick Menu, so
// there's no way to Save/Load State with a pad — only the keyboard F-keys. We
// default this to Start+Select so saving works out of the box for all our
// RetroArch games (retro consoles and, later, PSP).
const MENU_COMBO_KEY = "input_menu_toggle_gamepad_combo";
const START_SELECT = "4";

const stripQuotes = (value: string): string =>
  value.replace(/^"(.*)"$/, "$1").trim();

const findConfigFile = (executablePath: string): string | null => {
  for (const root of retroArchConfigRoots(executablePath)) {
    const cfg = path.join(root, "retroarch.cfg");
    if (fs.existsSync(cfg)) return cfg;
  }
  return null;
};

/**
 * Ensure RetroArch has a gamepad menu-toggle combo so the Quick Menu (and thus
 * Save/Load State) is reachable with a controller. Only sets our default when
 * the key is missing or explicitly "None" (0) — a user's own choice is left
 * untouched. No-ops if RetroArch hasn't written a config yet. Best-effort:
 * failures are logged, never thrown. Call while RetroArch is NOT running (it
 * rewrites the config on exit), i.e. just before launching a game.
 */
export const ensureRetroArchGamepadMenuCombo = (
  executablePath: string
): void => {
  try {
    const cfgPath = findConfigFile(executablePath);
    if (!cfgPath) return;

    const lines = fs.readFileSync(cfgPath, "utf8").split("\n");
    let found = false;
    let changed = false;

    for (let i = 0; i < lines.length; i++) {
      const eq = lines[i].indexOf("=");
      if (eq === -1) continue;
      if (lines[i].slice(0, eq).trim() !== MENU_COMBO_KEY) continue;

      found = true;
      const current = stripQuotes(lines[i].slice(eq + 1));
      // Never override a combo the user already picked; only fill in None/empty.
      if (current === "" || current === "0") {
        lines[i] = `${MENU_COMBO_KEY} = "${START_SELECT}"`;
        changed = true;
      }
      break;
    }

    if (!found) {
      lines.push(`${MENU_COMBO_KEY} = "${START_SELECT}"`);
      changed = true;
    }

    if (changed) {
      fs.writeFileSync(cfgPath, lines.join("\n"), "utf8");
      logger.info(
        `[retroarch] set ${MENU_COMBO_KEY}="${START_SELECT}" (Start+Select) in ${cfgPath}`
      );
    }
  } catch (error) {
    logger.warn("[retroarch] failed to set gamepad menu combo", error);
  }
};
