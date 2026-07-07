import axios from "axios";
import { logger } from "@main/services";

export async function isDirectLinkAvailable(url: string): Promise<boolean> {
  try {
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
    logger.error("[Localization] Direct link probe inconclusive:", error);
    return true;
  }
}
