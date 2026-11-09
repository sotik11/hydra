import type { ReleaseCalendarGame } from "@types";
import type { TFunction } from "i18next";

export interface CalendarCell {
  date: Date;
  key: string;
  inMonth: boolean;
  isToday: boolean;
}

const pad = (value: number) => String(value).padStart(2, "0");

// Local-time day key "YYYY-MM-DD".
export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

export const releaseDayKey = (game: ReleaseCalendarGame) =>
  dayKey(new Date(game.releaseDate * 1000));

export const parseDayKey = (value: string | null): Date | null => {
  const match = value?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3])
  );
  return Number.isNaN(date.getTime()) ? null : date;
};

// 1 = Monday … 7 = Sunday, from the locale (en-US starts on Sunday).
export const firstDayOfWeek = (language: string): number => {
  try {
    const locale = new Intl.Locale(language) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const info = locale.getWeekInfo?.() ?? locale.weekInfo;
    if (info?.firstDay) return info.firstDay;
  } catch {
    // fall through
  }
  return language.toLowerCase().startsWith("en") ? 7 : 1;
};

// 6 weeks × 7 days covering the month, starting on the locale's first weekday.
export const buildMonthGrid = (
  year: number,
  month: number,
  weekStart: number
): CalendarCell[] => {
  const first = new Date(year, month, 1);
  const isoWeekday = first.getDay() === 0 ? 7 : first.getDay();
  const offset = (isoWeekday - weekStart + 7) % 7;
  const todayKey = dayKey(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(year, month, 1 - offset + index);
    const key = dayKey(date);
    return {
      date,
      key,
      inMonth: date.getMonth() === month,
      isToday: key === todayKey,
    };
  });
};

export const weekdayLabels = (
  language: string,
  weekStart: number,
  style: "short" | "narrow"
) => {
  const format = new Intl.DateTimeFormat(language, { weekday: style });
  // 2024-01-01 is a Monday.
  return Array.from({ length: 7 }, (_, index) =>
    format.format(new Date(2024, 0, ((weekStart - 1 + index) % 7) + 1))
  );
};

export const monthLabel = (language: string, year: number, month: number) => {
  const label = new Intl.DateTimeFormat(language, {
    month: "long",
    year: "numeric",
  }).format(new Date(year, month, 1));
  return label.charAt(0).toUpperCase() + label.slice(1);
};

// Wishlist first, then by relevance.
export const compareInDay = (a: ReleaseCalendarGame, b: ReleaseCalendarGame) =>
  Number(b.isWishlisted) - Number(a.isWishlisted) || b.weight - a.weight;

export const groupByDay = (games: ReleaseCalendarGame[]) => {
  const days = new Map<string, ReleaseCalendarGame[]>();
  for (const game of games) {
    if (game.precision !== "day") continue;
    const key = releaseDayKey(game);
    const list = days.get(key);
    if (list) list.push(game);
    else days.set(key, [game]);
  }
  for (const list of days.values()) list.sort(compareInDay);
  return days;
};

// Imprecise games that belong to the shown month: same month for "month",
// same quarter for "quarter", same year for "year".
export const impreciseForMonth = (
  games: ReleaseCalendarGame[],
  year: number,
  month: number
) =>
  games
    .filter((game) => {
      if (game.precision === "day") return false;
      const date = new Date(game.releaseDate * 1000);
      if (date.getFullYear() !== year) return false;
      if (game.precision === "month") return date.getMonth() === month;
      if (game.precision === "quarter") {
        return Math.floor(date.getMonth() / 3) === Math.floor(month / 3);
      }
      return true;
    })
    .sort(compareInDay);

export const formatReleaseDate = (
  game: ReleaseCalendarGame,
  language: string,
  t: TFunction
) => {
  const date = new Date(game.releaseDate * 1000);
  switch (game.precision) {
    case "year":
      return String(date.getFullYear());
    case "quarter":
      return t("quarter", {
        quarter: Math.floor(date.getMonth() / 3) + 1,
        year: date.getFullYear(),
      });
    case "month":
      return monthLabel(language, date.getFullYear(), date.getMonth());
    default:
      return new Intl.DateTimeFormat(language, {
        day: "numeric",
        month: "short",
      }).format(date);
  }
};
