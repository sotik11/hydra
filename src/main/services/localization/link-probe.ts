import axios from "axios";
import { logger } from "@main/services";

// tiny ranged GET to check a mirror is really a file before we offer in-app download
// (dead links often 404 into an XML/HTML error body)
export async function isDirectLinkAvailable(url: string): Promise<boolean> {
  try {
    // same-origin Referer like the real downloader sends — some mirrors (GrajPoPolsku /dwn/) 403 without it
    let referer: string | undefined;
    try {
      referer = `${new URL(url).origin}/`;
    } catch {
      referer = undefined;
    }

    const response = await axios.get<unknown>(url, {
      headers: { Range: "bytes=0-0", ...(referer ? { Referer: referer } : {}) },
      timeout: 12000,
      responseType: "arraybuffer",
      maxContentLength: 4096,
      validateStatus: () => true,
    });

    const contentType = String(response.headers["content-type"] ?? "");
    const statusOk = response.status === 200 || response.status === 206;

    return (
      statusOk && !contentType.includes("xml") && !contentType.includes("html")
    );
  } catch (error) {
    // network blip? don't kill a probably-fine link — a real dead one fails the actual download
    logger.error("[Localization] Direct link probe inconclusive:", error);
    return true;
  }
}
