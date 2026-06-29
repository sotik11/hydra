import { db } from "../level";
import { levelKeys } from "./keys";
import type { LocalizationSource } from "@types";

export const localizationSourcesSublevel = db.sublevel<
  string,
  LocalizationSource
>(levelKeys.localizationSources, {
  valueEncoding: "json",
});
