import { useEffect } from "react";
import { useAppSelector } from "./redux";

/**
 * Fork: apply the user's banner appearance preferences at runtime via CSS
 * variables that the game-details hero and the profile banner read:
 *   - `--hero-height`          — banner height in px (unset → SCSS default)
 *   - `--hero-object-position` — vertical crop anchor (unset → "top")
 *
 * Reacting to preference changes makes them take effect live, without a restart.
 * (The avatar crop anchor is applied per-instance in profile-hero, so it only
 * affects your own avatar, not every avatar on screen.)
 */
export function useHeroBannerStyle() {
  const height = useAppSelector(
    (state) => state.userPreferences.value?.heroBannerHeight ?? null
  );
  const alignment = useAppSelector(
    (state) => state.userPreferences.value?.heroBannerAlignment ?? null
  );

  useEffect(() => {
    const root = document.documentElement;

    if (typeof height === "number") {
      root.style.setProperty("--hero-height", `${height}px`);
    } else {
      root.style.removeProperty("--hero-height");
    }
  }, [height]);

  useEffect(() => {
    const root = document.documentElement;

    if (alignment) {
      root.style.setProperty("--hero-object-position", alignment);
    } else {
      root.style.removeProperty("--hero-object-position");
    }
  }, [alignment]);
}
