import { useEffect } from "react";
import { useAppSelector } from "./redux";

/**
 * Fork: apply the user's banner appearance preferences at runtime via CSS
 * variables that the game-details hero and the profile banner read:
 *   - `--hero-height`          — banner height in px (unset → SCSS default)
 *   - `--hero-object-position` — banner crop anchor (unset → "top")
 *   - `--hero-avatar-align`    — vertical position of the profile avatar + name
 *                                block within the banner (unset → "center")
 *
 * Reacting to preference changes makes them take effect live, without a restart.
 */
export function useHeroBannerStyle() {
  const height = useAppSelector(
    (state) => state.userPreferences.value?.heroBannerHeight ?? null
  );
  const alignment = useAppSelector(
    (state) => state.userPreferences.value?.heroBannerAlignment ?? null
  );
  const avatarAlignment = useAppSelector(
    (state) => state.userPreferences.value?.heroAvatarAlignment ?? null
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

  useEffect(() => {
    const root = document.documentElement;

    if (avatarAlignment) {
      // Map to a flexbox alignment: "top" pins the block to the banner top,
      // "center" centres it (see profile-hero __background-overlay).
      root.style.setProperty(
        "--hero-avatar-align",
        avatarAlignment === "top" ? "flex-start" : "center"
      );
    } else {
      root.style.removeProperty("--hero-avatar-align");
    }
  }, [avatarAlignment]);
}
