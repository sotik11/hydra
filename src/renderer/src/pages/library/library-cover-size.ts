// Fork: cover size slider for the library grid. The slider sets the target
// cover width; columns are as many as fit. null = preset ("Compact" / "Grid"
// buttons), which keeps upstream's breakpoint table.

export const COVER_SIZE_STORAGE_KEY = "library-cover-size";
export const COVER_SIZE_MIN = 120;
export const COVER_SIZE_MAX = 360;
export const COVER_SIZE_STEP = 10;

export const clampCoverSize = (value: number) =>
  Math.min(
    COVER_SIZE_MAX,
    Math.max(
      COVER_SIZE_MIN,
      Math.round(value / COVER_SIZE_STEP) * COVER_SIZE_STEP
    )
  );

export const readStoredCoverSize = (): number | null => {
  try {
    const raw = localStorage.getItem(COVER_SIZE_STORAGE_KEY);
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? clampCoverSize(value) : null;
  } catch {
    return null;
  }
};

export const storeCoverSize = (value: number | null) => {
  try {
    if (value === null) localStorage.removeItem(COVER_SIZE_STORAGE_KEY);
    else localStorage.setItem(COVER_SIZE_STORAGE_KEY, String(value));
  } catch {
    // only loses the remembered size
  }
};

// Columns that fit the container at the given cover width.
export const columnsForCoverSize = (
  containerWidth: number,
  coverSize: number,
  gap: number
) => Math.max(1, Math.floor((containerWidth + gap) / (coverSize + gap)));

// Cover width produced by a column count (to show presets on the slider).
export const coverSizeForColumns = (
  containerWidth: number,
  columns: number,
  gap: number
) => (containerWidth - gap * (columns - 1)) / columns;
