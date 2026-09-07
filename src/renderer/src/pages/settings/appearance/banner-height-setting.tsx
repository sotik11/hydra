import { useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { PersonIcon } from "@primer/octicons-react";

import { SelectField } from "@renderer/components";
import { settingsContext } from "@renderer/context";
import { useAppSelector, useUserDetails } from "@renderer/hooks";

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

type BannerAlignment = "top" | "center" | "bottom";
type AvatarAlignment = "top" | "center";

const clamp = (value: number) =>
  Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, Math.round(value)));

/**
 * Fork: lets the user pick the banner height and the banner/avatar crop anchors.
 * Writes the heroBanner* preferences; app.tsx (use-hero-banner-style) and the
 * profile hero apply them live. The preview mirrors the real profile hero — the
 * user's own banner and avatar, cropped with the chosen anchors — so the effect
 * is visible right here. Height persistence is debounced so dragging the slider
 * doesn't spam the store.
 */
export function BannerHeightSetting() {
  const { t } = useTranslation("banner_height");
  const { updateUserPreferences } = useContext(settingsContext);
  const { userDetails, hasActiveSubscription } = useUserDetails();

  const userPreferences = useAppSelector(
    (state) => state.userPreferences.value
  );

  const storedHeight = userPreferences?.heroBannerHeight ?? null;
  const storedBannerAlignment = userPreferences?.heroBannerAlignment ?? "top";
  const storedAvatarAlignment = userPreferences?.heroAvatarAlignment ?? "center";

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

  const persistHeight = (height: number | null) => {
    clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => {
      updateUserPreferences({ heroBannerHeight: height });
    }, PERSIST_DELAY_MS);
  };

  const applyHeight = (next: number) => {
    const clamped = clamp(next);
    setValue(clamped);
    setDraft(String(clamped));
    persistHeight(clamped);
  };

  const commitDraft = () => applyHeight(Number(draft) || DEFAULT_HEIGHT);

  const handleReset = () => {
    clearTimeout(persistTimer.current);
    setValue(DEFAULT_HEIGHT);
    setDraft(String(DEFAULT_HEIGHT));
    updateUserPreferences({ heroBannerHeight: null });
  };

  // The preview shows the same image the profile does: local banner/avatar for a
  // non-subscriber, otherwise the Hydra Cloud one.
  const localBannerPath = userPreferences?.localProfileBannerPath ?? null;
  const localAvatarPath = userPreferences?.localProfileAvatarPath ?? null;
  const bannerUrl =
    !hasActiveSubscription && localBannerPath
      ? `local:${localBannerPath}`
      : (userDetails?.backgroundImageUrl ?? null);
  const avatarUrl =
    !hasActiveSubscription && localAvatarPath
      ? `local:${localAvatarPath}`
      : (userDetails?.profileImageUrl ?? null);

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
          onChange={(event) => applyHeight(Number(event.target.value))}
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

      <div className="banner-height-setting__alignments">
        <SelectField
          theme="dark"
          label={t("banner_alignment_label")}
          value={storedBannerAlignment}
          onChange={(event) =>
            updateUserPreferences({
              heroBannerAlignment: event.target.value as BannerAlignment,
            })
          }
          options={[
            { key: "top", value: "top", label: t("align_top") },
            { key: "center", value: "center", label: t("align_center") },
            { key: "bottom", value: "bottom", label: t("align_bottom") },
          ]}
        />

        <SelectField
          theme="dark"
          label={t("avatar_alignment_label")}
          value={storedAvatarAlignment}
          onChange={(event) =>
            updateUserPreferences({
              heroAvatarAlignment: event.target.value as AvatarAlignment,
            })
          }
          options={[
            { key: "top", value: "top", label: t("align_top") },
            { key: "center", value: "center", label: t("align_center") },
          ]}
        />
      </div>

      <div className="banner-height-setting__preview" aria-hidden="true">
        <div
          className="banner-height-setting__preview-bar"
          style={{
            height: `${Math.round(value * PREVIEW_SCALE)}px`,
            alignItems:
              storedAvatarAlignment === "top" ? "flex-start" : "center",
          }}
        >
          {bannerUrl && (
            <img
              className="banner-height-setting__preview-banner"
              src={bannerUrl}
              alt=""
              style={{ objectPosition: storedBannerAlignment }}
            />
          )}

          <div className="banner-height-setting__preview-avatar">
            {avatarUrl ? <img src={avatarUrl} alt="" /> : <PersonIcon size={20} />}
          </div>

          <span className="banner-height-setting__preview-label">
            {t("banner_height_preview")} · {value}px
          </span>
        </div>
      </div>
    </div>
  );
}
