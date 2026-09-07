import { useEffect } from "react";
import { useAppSelector } from "./redux";

/**
 * Fork: apply the user-configured banner height (Settings → Appearance) at
 * runtime by setting the `--hero-height` CSS variable that the game-details hero
 * and the profile banner read. An unset value removes the override so the SCSS
 * default (`$hero-height` in globals.scss) applies. Reacts to preference changes,
 * so a new height takes effect live, without a restart.
 */
export function useHeroBannerHeight() {
  const heroBannerHeight = useAppSelector(
    (state) => state.userPreferences.value?.heroBannerHeight ?? null
  );

  useEffect(() => {
    const root = document.documentElement;

    if (typeof heroBannerHeight === "number") {
      root.style.setProperty("--hero-height", `${heroBannerHeight}px`);
    } else {
      root.style.removeProperty("--hero-height");
    }
  }, [heroBannerHeight]);
}
