import log from "electron-log";

// Goes to logs.txt / info.txt / error.txt like the other main-process scopes.
export const releaseCalendarLogger = log.scope("release-calendar");
