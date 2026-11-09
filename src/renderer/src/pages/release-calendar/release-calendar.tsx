import { Fragment, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate, useSearchParams } from "react-router-dom";
import cn from "classnames";
import {
  AlertIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  SyncIcon,
} from "@primer/octicons-react";
import { Button } from "@renderer/components";
import { buildGameDetailsPath } from "@renderer/helpers";
import type { ReleaseCalendarGame } from "@types";
import {
  buildMonthGrid,
  dayKey,
  firstDayOfWeek,
  formatReleaseDate,
  groupByDay,
  impreciseForMonth,
  monthLabel,
  parseDayKey,
  weekdayLabels,
} from "./calendar-helpers";
import { ReleaseMarkers } from "./release-markers";
import { useReleaseCalendar } from "./use-release-calendar";
import "./release-calendar-i18n";
import "./release-calendar.scss";

type ReleaseFilter = "all" | "wishlist";

const COVERS_PER_CELL = 2;

function GameCard({
  game,
  dateLabel,
  onOpen,
}: Readonly<{
  game: ReleaseCalendarGame;
  dateLabel?: string;
  onOpen: (game: ReleaseCalendarGame) => void;
}>) {
  return (
    <button
      type="button"
      className="release-calendar__game"
      onClick={() => onOpen(game)}
      title={game.title}
    >
      <span className="release-calendar__game-cover">
        {game.cover ? (
          <img src={game.cover} alt="" loading="lazy" />
        ) : (
          <span className="release-calendar__game-cover-fallback">
            {game.title}
          </span>
        )}
      </span>
      <span className="release-calendar__game-title">{game.title}</span>
      {dateLabel && (
        <span className="release-calendar__game-date">{dateLabel}</span>
      )}
      <ReleaseMarkers game={game} showEarlyAccess />
    </button>
  );
}

export default function ReleaseCalendar() {
  const { t, i18n } = useTranslation("release_calendar");
  const language = i18n.language;
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialDate = useMemo(
    () => parseDayKey(searchParams.get("date")),
    [searchParams]
  );
  const [cursor, setCursor] = useState(() => {
    const date = initialDate ?? new Date();
    return { year: date.getFullYear(), month: date.getMonth() };
  });
  const [selectedKey, setSelectedKey] = useState<string | null>(
    initialDate ? dayKey(initialDate) : null
  );
  const [filter, setFilter] = useState<ReleaseFilter>("all");

  const { data, isLoading, hasError, refresh } = useReleaseCalendar();

  const weekStart = useMemo(() => firstDayOfWeek(language), [language]);
  const weekdays = useMemo(
    () => weekdayLabels(language, weekStart, "short"),
    [language, weekStart]
  );

  const games = useMemo(
    () =>
      (data?.games ?? []).filter(
        (game) => filter === "all" || game.isWishlisted
      ),
    [data, filter]
  );
  const byDay = useMemo(() => groupByDay(games), [games]);
  const imprecise = useMemo(
    () => impreciseForMonth(games, cursor.year, cursor.month),
    [games, cursor]
  );
  const weeks = useMemo(() => {
    const cells = buildMonthGrid(cursor.year, cursor.month, weekStart);
    return Array.from({ length: 6 }, (_, index) =>
      cells.slice(index * 7, index * 7 + 7)
    );
  }, [cursor, weekStart]);

  const monthHasGames = weeks.some((week) =>
    week.some((cell) => cell.inMonth && byDay.has(cell.key))
  );

  const shiftMonth = (delta: number) => {
    setSelectedKey(null);
    setCursor(({ year, month }) => {
      const date = new Date(year, month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  const goToday = () => {
    const today = new Date();
    setCursor({ year: today.getFullYear(), month: today.getMonth() });
    setSelectedKey(dayKey(today));
  };

  const openGame = (game: ReleaseCalendarGame) => {
    navigate(
      buildGameDetailsPath({
        shop: "steam",
        objectId: game.appId,
        title: game.title,
      })
    );
  };

  const selectedGames = selectedKey ? (byDay.get(selectedKey) ?? []) : [];

  return (
    <section className="release-calendar">
      <div className="release-calendar__toolbar">
        <div className="release-calendar__nav">
          <button
            type="button"
            className="release-calendar__icon-button"
            onClick={() => shiftMonth(-1)}
            title={t("previous_month")}
          >
            <ChevronLeftIcon />
          </button>
          <h2 className="release-calendar__month">
            {monthLabel(language, cursor.year, cursor.month)}
          </h2>
          <button
            type="button"
            className="release-calendar__icon-button"
            onClick={() => shiftMonth(1)}
            title={t("next_month")}
          >
            <ChevronRightIcon />
          </button>
          <Button theme="outline" size="small" onClick={goToday}>
            {t("today")}
          </Button>
        </div>

        <div className="release-calendar__actions">
          <div className="release-calendar__filter" role="tablist">
            {(["all", "wishlist"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={filter === value}
                className={cn("release-calendar__filter-option", {
                  "release-calendar__filter-option--active": filter === value,
                })}
                onClick={() => setFilter(value)}
              >
                {t(value === "all" ? "filter_all" : "filter_wishlist")}
              </button>
            ))}
          </div>
          <Button
            theme="outline"
            size="small"
            onClick={() => void refresh()}
            disabled={isLoading}
          >
            <SyncIcon className={cn({ "release-calendar__spin": isLoading })} />
            {t("refresh")}
          </Button>
        </div>
      </div>

      {data && data.personalStatus !== "ok" && (
        <div className="release-calendar__notice">
          <AlertIcon />
          {t(
            data.personalStatus === "cached"
              ? "status_cached"
              : "status_unavailable"
          )}
        </div>
      )}

      {hasError && !data && (
        <div className="release-calendar__notice release-calendar__notice--error">
          <AlertIcon />
          {t("load_failed")}
          <Button theme="outline" size="small" onClick={() => void refresh()}>
            {t("retry")}
          </Button>
        </div>
      )}

      {imprecise.length > 0 && (
        <div className="release-calendar__imprecise">
          <h3 className="release-calendar__imprecise-title">
            {t("imprecise_title")}
          </h3>
          <div className="release-calendar__imprecise-list">
            {imprecise.map((game) => (
              <GameCard
                key={game.appId}
                game={game}
                dateLabel={formatReleaseDate(game, language, t)}
                onOpen={openGame}
              />
            ))}
          </div>
        </div>
      )}

      <div className="release-calendar__grid">
        <div className="release-calendar__weekdays">
          {weekdays.map((label) => (
            <span key={label} className="release-calendar__weekday">
              {label}
            </span>
          ))}
        </div>

        {weeks.map((week) => {
          const isSelectedWeek =
            selectedKey !== null &&
            week.some((cell) => cell.key === selectedKey);

          return (
            <Fragment key={week[0].key}>
              <div className="release-calendar__week">
                {week.map((cell) => {
                  const dayGames = byDay.get(cell.key) ?? [];
                  const shown = dayGames.slice(0, COVERS_PER_CELL);
                  const extra = dayGames.length - shown.length;

                  return (
                    <button
                      key={cell.key}
                      type="button"
                      className={cn("release-calendar__day", {
                        "release-calendar__day--outside": !cell.inMonth,
                        "release-calendar__day--today": cell.isToday,
                        "release-calendar__day--selected":
                          cell.key === selectedKey,
                        "release-calendar__day--empty": dayGames.length === 0,
                      })}
                      disabled={dayGames.length === 0}
                      onClick={() =>
                        setSelectedKey((current) =>
                          current === cell.key ? null : cell.key
                        )
                      }
                    >
                      <span className="release-calendar__day-number">
                        {cell.date.getDate()}
                      </span>
                      {shown.length > 0 && (
                        <span
                          className={cn("release-calendar__day-covers", {
                            "release-calendar__day-covers--single":
                              shown.length === 1,
                          })}
                        >
                          {shown.map((game) => (
                            <span
                              key={game.appId}
                              className="release-calendar__day-cover"
                              title={game.title}
                            >
                              {game.cover ? (
                                <img src={game.cover} alt="" loading="lazy" />
                              ) : (
                                <span className="release-calendar__game-cover-fallback">
                                  {game.title}
                                </span>
                              )}
                              <span className="release-calendar__day-cover-markers">
                                <ReleaseMarkers game={game} />
                              </span>
                            </span>
                          ))}
                        </span>
                      )}
                      {extra > 0 && (
                        <span className="release-calendar__day-more">
                          {t("more", { count: extra })}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {isSelectedWeek && selectedGames.length > 0 && (
                <div className="release-calendar__expanded">
                  <div className="release-calendar__expanded-header">
                    <span>
                      {new Intl.DateTimeFormat(language, {
                        weekday: "long",
                        day: "numeric",
                        month: "long",
                      }).format(parseDayKey(selectedKey) ?? new Date())}
                    </span>
                    <span className="release-calendar__expanded-count">
                      {t("games_count", { count: selectedGames.length })}
                    </span>
                  </div>
                  <div className="release-calendar__expanded-list">
                    {selectedGames.map((game) => (
                      <GameCard
                        key={game.appId}
                        game={game}
                        onOpen={openGame}
                      />
                    ))}
                  </div>
                </div>
              )}
            </Fragment>
          );
        })}
      </div>

      {isLoading && !data && (
        <p className="release-calendar__hint">{t("loading")}</p>
      )}
      {data && !monthHasGames && imprecise.length === 0 && (
        <p className="release-calendar__hint">{t("empty_month")}</p>
      )}
    </section>
  );
}
