import { Grid2x2, Grid3x3 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  COVER_SIZE_MAX,
  COVER_SIZE_MIN,
  COVER_SIZE_STEP,
  clampCoverSize,
} from "./library-cover-size";
import "./library-i18n";
import "./library-cover-size-slider.scss";

interface LibraryCoverSizeSliderProps {
  // Current cover width (stored or the active preset's).
  value: number;
  onChange: (value: number) => void;
}

export function LibraryCoverSizeSlider({
  value,
  onChange,
}: Readonly<LibraryCoverSizeSliderProps>) {
  const { t } = useTranslation("library_fork");
  const shown = clampCoverSize(value);

  return (
    <label className="library-cover-size" title={t("cover_size")}>
      <Grid3x3 size={14} className="library-cover-size__icon" />
      <input
        type="range"
        className="library-cover-size__input"
        min={COVER_SIZE_MIN}
        max={COVER_SIZE_MAX}
        step={COVER_SIZE_STEP}
        value={shown}
        aria-label={t("cover_size")}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <Grid2x2 size={18} className="library-cover-size__icon" />
    </label>
  );
}
