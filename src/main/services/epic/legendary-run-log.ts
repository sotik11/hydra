/**
 * Fork: diagnostics for every Legendary run.
 *
 * Upstream maps any failed `legendary.exe` run to "auth-failed" ("Epic sign-in
 * failed") and never logs the process output, so the real cause stays hidden.
 * Here each run is logged with its command, exit code, duration and — on
 * failure — the tail of stderr, with secrets stripped (legendary-run-redact.ts).
 * Installed once at startup (main.ts) through the hook in legendary-auth.ts.
 */
import { logger } from "../logger";
import {
  observeLegendaryRuns,
  type LegendaryRunReport,
} from "./legendary-auth";
import {
  describeLegendaryArgs,
  redactLegendaryText,
} from "./legendary-run-redact";

export const logLegendaryRun = (report: LegendaryRunReport) => {
  const summary = `[legendary] ${describeLegendaryArgs(report.args)} -> ${report.outcome}${
    report.errorCode ? ` (${report.errorCode})` : ""
  }, exit=${report.exitCode ?? "-"}, ${Math.round(report.durationMs)}ms, stdout=${report.stdoutBytes}B`;

  if (report.outcome === "ok" || report.outcome === "operation-cancelled") {
    logger.info(summary);
    return;
  }

  const tail = redactLegendaryText(report.stderrTail).trim();
  logger.error(tail ? `${summary}\n--- stderr (tail) ---\n${tail}` : summary);
};

export const installLegendaryRunLog = () =>
  observeLegendaryRuns(logLegendaryRun);
