import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { logger } from "@renderer/logger";
import type { ReleaseCalendarData } from "@types";

// Shared between the profile mini-block and the page, so opening the page
// after the profile shows data at once. The main process keeps the real cache;
// this one only avoids an empty first frame.
let memory: { language: string; data: ReleaseCalendarData } | null = null;

export function useReleaseCalendar() {
  const { i18n } = useTranslation();
  const language = i18n.language;

  const [data, setData] = useState<ReleaseCalendarData | null>(
    memory?.language === language ? memory.data : null
  );
  const [isLoading, setIsLoading] = useState(data === null);
  const [hasError, setHasError] = useState(false);

  const load = useCallback(
    async (forceRefresh: boolean) => {
      setIsLoading(true);
      setHasError(false);
      try {
        const result = await window.electron.getReleaseCalendar(
          forceRefresh,
          language
        );
        memory = { language, data: result };
        setData(result);
      } catch (error) {
        logger.error("[release-calendar] load failed", error);
        setHasError(true);
      } finally {
        setIsLoading(false);
      }
    },
    [language]
  );

  useEffect(() => {
    // Always ask main: it answers from its cache when fresh, and re-applies
    // wishlist flags that may have changed since the last visit.
    void load(false);
  }, [load]);

  const refresh = useCallback(() => load(true), [load]);

  return { data, isLoading, hasError, refresh };
}
