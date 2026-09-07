import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { settingsContext } from "@renderer/context";
import { useAppSelector } from "@renderer/hooks";

import "./banner-height-i18n";
import "./banner-height-setting.scss";

const MIN_HEIGHT = 300;
const MAX_HEIGHT = 650;
const STEP = 10;
// Keep in sync with the $hero-height default in scss/globals.scss.
const DEFAULT_HEIGHT = 450;
const PERSIST_DELAY_MS = 250;
// The preview strip is a scaled-down stand-in for the real banner.
const PREVIEW_SCALE = 0.28;

const clamp = (value: number) =>
  Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(value)));

/**
 * Fork: lets the user pick the game/profile banner height. Writes the
 * `heroBannerHeight` preference; app.tsx applies it live via the --hero-height
 * CSS variable (see use-hero-banner-height). Persisting is debounced so dragging
 * the slider doesn't spam the store.
 */
export function BannerHeightSetting() {
  const { t } = useTranslation("banner_height");
  const { updateUserPreferences } = useContext(settingsContext);

  const storedHeight = useAppSelector(
    (state) => state.userPreferences.value?.heroBannerHeight ?? null
  );

  const [value, setValue] = useState(storedHeight ?? DEFAULT_HEIGHT);
  const [draft, setDraft] = useState(String(storedHeight ?? DEFAULT_HEIGHT));
  const persistTimer = useRef<ReturnType<typeof setTimeout>>();

  // Reflect external changes (prefs reload, reset elsewhere).
  useEffect(() => {
    const next = storedHeight ?? DEFAULT_HEIGHT;
    setValue(next);
    setDraft(String(next));
  }, [storedHeight]);

  useEffect(() => () => clearTimeout(persistTimer.current), []);

  const persist = (height: number | null) => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      updateUserPreferences({ heroBannerHeight: height });
    }, PERSIST_DELAY_MS);
  };

  const apply = (next: number) => {
    const clamped = clamp(next);
    setValue(clamped);
    setDraft(String(clamped));
    persist(clamped);
  };

  const commitDraft = () => apply(Number(draft) || DEFAULT_HEIGHT);

  const handleReset = () => {
    clearTimeout(persistTimer.current);
    setValue(DEFAULT_HEIGHT);
    setDraft(String(DEFAULT_HEIGHT));
    updateUserPreferences({ heroBannerHeight: null });
  };

  return (
    <div className="banner-height-setting">
      <div className="banner-height-setting__header">
        <h3 className="banner-height-setting__title">
          {t("banner_height_title")}
        </h3>
        <p className="banner-height-setting__description">
          {t("banner_height_description")}
        </p>
      </div>

      <div className="banner-height-setting__controls">
        <input
          type="range"
          className="banner-height-setting__slider"
          min={MIN_HEIGHT}
          max={MAX_HEIGHT}
          step={STEP}
          value={value}
          aria-label={t("banner_height_title")}
          onChange={(event) => apply(Number(event.target.value))}
        />

        <div className="banner-height-setting__value">
          <input
            type="number"
            className="banner-height-setting__number"
            min={MIN_HEIGHT}
            max={MAX_HEIGHT}
            step={STEP}
            value={draft}
            aria-label={t("banner_height_title")}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commitDraft}
            onKeyDown={(event) => {
              if (event.key === "Enter") commitDraft();
            }}
          />
          <span className="banner-height-setting__unit">px</span>
        </div>

        <button
          type="button"
          className="banner-height-setting__reset"
          onClick={handleReset}
          disabled={storedHeight === null}
        >
          {t("banner_height_reset")}
        </button>
      </div>

      <div className="banner-height-setting__preview" aria-hidden="true">
        <div
          className="banner-height-setting__preview-bar"
          style={{ height: `${Math.round(value * PREVIEW_SCALE)}px` }}
        >
          <span className="banner-height-setting__preview-label">
            {t("banner_height_preview")} · {value}px
          </span>
        </div>
      </div>
    </div>
  );
}
