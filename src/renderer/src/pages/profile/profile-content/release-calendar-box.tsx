import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import cn from "classnames";
import { CalendarIcon, ListUnorderedIcon } from "@primer/octicons-react";
import { buildGameDetailsPath } from "@renderer/helpers";
import type { ReleaseCalendarGame } from "@types";
import { ProfileSection } from "../profile-section/profile-section";
import {
  buildMonthGrid,
  compareInDay,
  firstDayOfWeek,
  formatReleaseDate,
  groupByDay,
  monthLabel,
  weekdayLabels,
} from "@renderer/pages/release-calendar/calendar-helpers";
import { ReleaseMarkers } from "@renderer/pages/release-calendar/release-markers";
import { useReleaseCalendar } from "@renderer/pages/release-calendar/use-release-calendar";
import "@renderer/pages/release-calendar/release-calendar-i18n";
import { useReleaseCalendarAvailable } from "@renderer/pages/release-calendar/use-release-calendar-available";
import "./release-calendar-box.scss";

type BoxView = "grid" | "list";

const VIEW_STORAGE_KEY = "release-calendar-box-view";
const LIST_LIMIT = 6;
const CALENDAR_PATH = "/release-calendar";

const readStoredView = (): BoxView => {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === "list" ? "list" : "grid";
  } catch {
    return "grid";
  }
};

// Profile mini-block: wishlist releases only; popular ones when the wishlist
// has nothing upcoming. Own profile only.
// Hidden (and no Steam requests made) when turned off in Settings → Integrations.
export function ReleaseCalendarSection() {
  const available = useReleaseCalendarAvailable();
  if (!available) return null;
  return <ReleaseCalendarSectionContent />;
}

function ReleaseCalendarSectionContent() {
  const { t, i18n } = useTranslation("release_calendar");
  const language = i18n.language;
  const navigate = useNavigate();
  const [view, setView] = useState<BoxView>(readStoredView);
  const { data, isLoading, hasError } = useReleaseCalendar();

  const today = useMemo(() => new Date(), []);
  const startOfMonth = useMemo(
    () => new Date(today.getFullYear(), today.getMonth(), 1).getTime() / 1000,
    [today]
  );
  const startOfToday = useMemo(
    () =>
      new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate()
      ).getTime() / 1000,
    [today]
  );

  const { games, isPopularFallback } = useMemo(() => {
    const all = data?.games ?? [];
    const wishlist = all.filter(
      (game) => game.isWishlisted && game.releaseDate >= startOfMonth
    );
    if (wishlist.length > 0) {
      return { games: wishlist, isPopularFallback: false };
    }
    return {
      games: all.filter(
        (game) =>
          (game.isPopular || game.isPersonal) &&
          game.releaseDate >= startOfMonth
      ),
      isPopularFallback: all.length > 0,
    };
  }, [data, startOfMonth]);

  const toggleView = () => {
    const next: BoxView = view === "grid" ? "list" : "grid";
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // view just won't be remembered
    }
  };

  const openGame = (game: ReleaseCalendarGame) =>
    navigate(
      buildGameDetailsPath({
        shop: "steam",
        objectId: game.appId,
        title: game.title,
      })
    );

  const action = (
    <button
      type="button"
      className="release-calendar-box__view-toggle"
      onClick={toggleView}
      title={t(view === "grid" ? "view_list" : "view_grid")}
    >
      {view === "grid" ? (
        <ListUnorderedIcon size={16} />
      ) : (
        <CalendarIcon size={16} />
      )}
    </button>
  );

  return (
    <ProfileSection title={t("box_title")} action={action} defaultOpen={true}>
      <div className="release-calendar-box">
        {!data && isLoading && (
          <p className="release-calendar-box__hint">{t("loading")}</p>
        )}
        {!data && hasError && (
          <p className="release-calendar-box__hint">{t("load_failed")}</p>
        )}

        {data && isPopularFallback && (
          <p className="release-calendar-box__hint">{t("box_popular_hint")}</p>
        )}

        {data && view === "grid" && (
          <MiniMonth
            games={games}
            language={language}
            onOpenDay={(key) => navigate(`${CALENDAR_PATH}?date=${key}`)}
          />
        )}

        {data && view === "list" && (
          <UpcomingList
            games={games}
            startOfToday={startOfToday}
            language={language}
            onOpen={openGame}
          />
        )}

        <button
          type="button"
          className="release-calendar-box__open"
          onClick={() => navigate(CALENDAR_PATH)}
        >
          {t("open_calendar")}
        </button>
      </div>
    </ProfileSection>
  );
}

function MiniMonth({
  games,
  language,
  onOpenDay,
}: Readonly<{
  games: ReleaseCalendarGame[];
  language: string;
  onOpenDay: (key: string) => void;
}>) {
  const today = new Date();
  const weekStart = firstDayOfWeek(language);
  const cells = buildMonthGrid(
    today.getFullYear(),
    today.getMonth(),
    weekStart
  );
  // Drop a trailing week made only of next-month days.
  const visibleCells = cells[35].inMonth ? cells : cells.slice(0, 35);
  const byDay = groupByDay(games);
  const weekdays = weekdayLabels(language, weekStart, "narrow");

  return (
    <div className="release-calendar-box__month">
      <span className="release-calendar-box__month-label">
        {monthLabel(language, today.getFullYear(), today.getMonth())}
      </span>
      <div className="release-calendar-box__grid">
        {weekdays.map((label, index) => (
          <span
            key={`${label}-${index}`}
            className="release-calendar-box__weekday"
          >
            {label}
          </span>
        ))}
        {visibleCells.map((cell) => {
          const dayGames = byDay.get(cell.key) ?? [];
          const first = dayGames[0];
          return (
            <button
              key={cell.key}
              type="button"
              className={cn("release-calendar-box__day", {
                "release-calendar-box__day--outside": !cell.inMonth,
                "release-calendar-box__day--today": cell.isToday,
                "release-calendar-box__day--has-games": Boolean(first),
              })}
              disabled={!first}
              title={dayGames.map((game) => game.title).join("\n")}
              onClick={() => onOpenDay(cell.key)}
            >
              {first?.cover && (
                <img
                  src={first.cover}
                  alt=""
                  loading="lazy"
                  className="release-calendar-box__day-cover"
                />
              )}
              <span className="release-calendar-box__day-number">
                {cell.date.getDate()}
              </span>
              {dayGames.length > 1 && (
                <span className="release-calendar-box__day-count">
                  {dayGames.length}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function UpcomingList({
  games,
  startOfToday,
  language,
  onOpen,
}: Readonly<{
  games: ReleaseCalendarGame[];
  startOfToday: number;
  language: string;
  onOpen: (game: ReleaseCalendarGame) => void;
}>) {
  const { t } = useTranslation("release_calendar");

  const upcoming = useMemo(() => {
    const dated = games
      .filter(
        (game) => game.precision === "day" && game.releaseDate >= startOfToday
      )
      .sort((a, b) => a.releaseDate - b.releaseDate || compareInDay(a, b));
    const undated = games
      .filter((game) => game.precision !== "day")
      .sort((a, b) => a.releaseDate - b.releaseDate || compareInDay(a, b));
    return [...dated, ...undated].slice(0, LIST_LIMIT);
  }, [games, startOfToday]);

  if (upcoming.length === 0) {
    return <p className="release-calendar-box__hint">{t("empty_upcoming")}</p>;
  }

  return (
    <ul className="release-calendar-box__list">
      {upcoming.map((game) => (
        <li key={game.appId}>
          <button
            type="button"
            className="release-calendar-box__item"
            onClick={() => onOpen(game)}
          >
            {game.cover ? (
              <img
                src={game.cover}
                alt=""
                loading="lazy"
                className="release-calendar-box__item-cover"
              />
            ) : (
              <span className="release-calendar-box__item-cover" />
            )}
            <span className="release-calendar-box__item-details">
              <span className="release-calendar-box__item-title">
                {game.title}
              </span>
              <span className="release-calendar-box__item-date">
                {formatReleaseDate(game, language, t)}
                <ReleaseMarkers game={game} />
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
