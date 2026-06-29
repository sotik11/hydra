import fs from "node:fs";
import path from "node:path";

import { logger } from "@main/services";
import { JsHttpDownloader } from "@main/services/download/js-http-downloader";
import { SevenZip } from "@main/services/7zip";
import { WindowManager } from "@main/services/window-manager";
import type {
  LocalizationDownloadProgress,
  LocalizationDownloadStatus,
} from "@types";

export const LOCALIZATION_DOWNLOAD_PROGRESS_CHANNEL =
  "on-localization-download-progress";

const PROGRESS_BROADCAST_INTERVAL_MS = 500;

export interface LocalizationDownloadRequest {
  studio: string;
  url: string;
  savePath: string;
  autoExtract: boolean;
  deleteArchive: boolean;
}

// kept separate from Hydra's game-download manager on purpose, so localizations
// never show up as library entries. one at a time — a new start cancels the old.
export class LocalizationDownloadManager {
  private static downloader: JsHttpDownloader | null = null;
  private static request: LocalizationDownloadRequest | null = null;
  private static broadcastTimer: NodeJS.Timeout | null = null;

  public static isDownloading(): boolean {
    return this.request !== null;
  }

  public static start(request: LocalizationDownloadRequest): void {
    this.cancel();

    this.request = request;
    this.downloader = new JsHttpDownloader();
    this.startBroadcasting();

    void this.run(request);
  }

  public static cancel(): void {
    const cancelledStudio = this.request?.studio ?? null;

    this.stopBroadcasting();
    if (this.downloader) {
      this.downloader.cancelDownload(true);
    }
    this.downloader = null;
    this.request = null;

    if (cancelledStudio !== null) {
      WindowManager.sendToAppWindows(LOCALIZATION_DOWNLOAD_PROGRESS_CHANNEL, {
        studio: cancelledStudio,
        status: "cancelled",
        progress: 0,
        downloadSpeed: 0,
        bytesDownloaded: 0,
        fileSize: 0,
        fileName: "",
        filePath: null,
      });
    }
  }

  private static async run(
    request: LocalizationDownloadRequest
  ): Promise<void> {
    try {
      await this.downloader!.startDownload({
        url: request.url,
        savePath: request.savePath,
        headers: this.buildRequestHeaders(request.url),
      });
    } catch (error) {
      logger.error("[LocalizationDownload] Download failed:", error);
      this.finish("error", null);
      return;
    }

    // A newer download replaced this one (or it was cancelled) while running.
    if (this.request !== request) return;

    const status = this.downloader?.getDownloadStatus();
    if (status?.status !== "complete") {
      this.finish(status?.status === "paused" ? "cancelled" : "error", null);
      return;
    }

    const archivePath = path.join(request.savePath, status.folderName);

    if (request.autoExtract) {
      this.stopBroadcasting();
      this.broadcast("extracting", 1, archivePath);

      try {
        const outputDir = path.join(
          request.savePath,
          status.folderName.replace(/\.[^.]+$/, "")
        );
        await SevenZip.extractFile({
          filePath: archivePath,
          outputPath: outputDir,
        });

        if (request.deleteArchive) {
          await fs.promises.unlink(archivePath).catch((error) => {
            logger.error(
              "[LocalizationDownload] Failed to delete archive:",
              error
            );
          });
        }

        if (this.request !== request) return;
        this.finish("complete", outputDir);
      } catch (error) {
        logger.error("[LocalizationDownload] Extraction failed:", error);
        if (this.request !== request) return;
        this.finish("error", archivePath);
      }

      return;
    }

    this.finish("complete", archivePath);
  }

  // same-origin Referer unlocks hotlink-protected mirrors (GrajPoPolsku /dwn/ 403s without it)
  private static buildRequestHeaders(url: string): Record<string, string> {
    try {
      return { Referer: `${new URL(url).origin}/` };
    } catch {
      return {};
    }
  }

  private static startBroadcasting(): void {
    this.stopBroadcasting();
    this.broadcastTimer = setInterval(() => {
      this.broadcast("active", null, null);
    }, PROGRESS_BROADCAST_INTERVAL_MS);
  }

  private static stopBroadcasting(): void {
    if (this.broadcastTimer) {
      clearInterval(this.broadcastTimer);
      this.broadcastTimer = null;
    }
  }

  private static finish(
    status: LocalizationDownloadStatus,
    filePath: string | null
  ): void {
    this.stopBroadcasting();
    this.broadcast(status, status === "complete" ? 1 : null, filePath);
    this.downloader = null;
    this.request = null;
  }

  private static broadcast(
    status: LocalizationDownloadStatus,
    progressOverride: number | null,
    filePath: string | null
  ): void {
    const downloadStatus = this.downloader?.getDownloadStatus();

    const payload: LocalizationDownloadProgress = {
      studio: this.request?.studio ?? "",
      status,
      progress: progressOverride ?? downloadStatus?.progress ?? 0,
      downloadSpeed: downloadStatus?.downloadSpeed ?? 0,
      bytesDownloaded: downloadStatus?.bytesDownloaded ?? 0,
      fileSize: downloadStatus?.fileSize ?? 0,
      fileName: downloadStatus?.folderName ?? "",
      filePath,
    };

    WindowManager.sendToAppWindows(
      LOCALIZATION_DOWNLOAD_PROGRESS_CHANNEL,
      payload
    );
  }
}
