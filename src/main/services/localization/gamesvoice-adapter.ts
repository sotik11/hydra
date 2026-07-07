import axios from "axios";
import { logger } from "@main/services";
import type {
  GameLocalization,
  LocalizationMirror,
  LocalizationStore,
  LocalizationSourceGame,
  GameShop,
} from "@types";
import { isDirectLinkAvailable } from "./link-probe";

interface GamesVoiceProduct {
  title_eng: string;
  title_rus: string;
  alias: string;
  file: string | null;
  yandex_link: string | null;
  google_link: string | null;
  mail_link: string | null;
  stores: { name: string; img: string; link: string }[] | null;
  instruction: string | null;
  updates: string | null;
  is_text: number;
  is_sound: number;
  is_song: number;
  is_texture: number;
  is_active: number;
  is_develop: number;
}

interface GamesVoiceCatalogueResponse {
  success: boolean;
  data: GamesVoiceProduct[];
}

export interface LocalizationQuery {
  shop: GameShop;
  objectId: string;
  title: string;
}

export class GamesVoiceAdapter {
  static readonly studioName = "GamesVoice";

  static readonly language = "Русский";

  static readonly studioUrl = "https://www.gamesvoice.ru";

  private static readonly catalogueUrl =
    "https://api.gamesvoice.ru/api/products";
  private static readonly productPageBaseUrl =
    "https://www.gamesvoice.ru/product/";
  private static readonly cacheTtlMs = 30 * 60 * 1000;

  private static cachedProducts: GamesVoiceProduct[] | null = null;
  private static cacheFilledAt = 0;

  public static async search(
    query: LocalizationQuery
  ): Promise<GameLocalization[]> {
    let products: GamesVoiceProduct[];

    try {
      products = await this.getCatalogue();
    } catch (error) {
      logger.error("[GamesVoice] Failed to fetch catalogue:", error);
      return [];
    }

    const matchedProduct = this.findMatchingProduct(products, query);
    if (!matchedProduct) return [];

    const localization = this.toGameLocalization(matchedProduct);
    const directMirror = localization.mirrors.find(
      (mirror) => mirror.kind === "direct"
    );
    localization.directAvailable = directMirror
      ? await isDirectLinkAvailable(directMirror.url)
      : false;

    return [localization];
  }

  private static async getCatalogue(): Promise<GamesVoiceProduct[]> {
    const cacheIsFresh =
      this.cachedProducts !== null &&
      Date.now() - this.cacheFilledAt < this.cacheTtlMs;

    if (cacheIsFresh) return this.cachedProducts!;

    const response = await axios.get<GamesVoiceCatalogueResponse>(
      this.catalogueUrl,
      { timeout: 15000 }
    );

    const products = response.data?.data ?? [];
    this.cachedProducts = products;
    this.cacheFilledAt = Date.now();

    return products;
  }

  private static findMatchingProduct(
    products: GamesVoiceProduct[],
    query: LocalizationQuery
  ): GamesVoiceProduct | null {
    const activeProducts = products.filter(
      (product) => product.is_active === 1
    );

    if (query.shop === "steam") {
      const productByAppId = activeProducts.find((product) =>
        this.productPointsToSteamApp(product, query.objectId)
      );
      if (productByAppId) return productByAppId;
    }

    const normalizedTitle = this.normalizeTitle(query.title);
    if (!normalizedTitle) return null;

    return (
      activeProducts.find(
        (product) =>
          this.normalizeTitle(product.title_eng) === normalizedTitle ||
          this.normalizeTitle(product.title_rus) === normalizedTitle
      ) ?? null
    );
  }

  private static productPointsToSteamApp(
    product: GamesVoiceProduct,
    appId: string
  ): boolean {
    return this.extractSteamAppId(product) === appId;
  }

  private static extractSteamAppId(product: GamesVoiceProduct): string | null {
    for (const store of product.stores ?? []) {
      const appIdInLink = store.link.match(/\/app\/(\d+)/)?.[1];
      if (appIdInLink) return appIdInLink;
    }
    return null;
  }

  public static async listGames(): Promise<LocalizationSourceGame[]> {
    let products: GamesVoiceProduct[];

    try {
      products = await this.getCatalogue();
    } catch (error) {
      logger.error("[GamesVoice] Failed to fetch catalogue:", error);
      return [];
    }

    return products
      .filter((product) => product.is_active === 1)
      .map((product) => {
        const appId = this.extractSteamAppId(product);
        if (!appId) return null;

        return {
          shop: "steam" as GameShop,
          objectId: appId,
          title: product.title_eng || product.title_rus,
        };
      })
      .filter((game): game is LocalizationSourceGame => game !== null);
  }

  private static normalizeTitle(title: string | null): string {
    if (!title) return "";
    return title
      .toLowerCase()
      .replace(/['’:.,!?®™–—-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  private static toGameLocalization(
    product: GamesVoiceProduct
  ): GameLocalization {
    const { version, updatedAt } = this.parseLatestUpdate(product.updates);

    return {
      studio: this.studioName,
      studioUrl: this.studioUrl,
      language: this.language,
      title: product.title_eng || product.title_rus,
      pageUrl: `${this.productPageBaseUrl}${product.alias}`,
      changelogHtml: product.updates?.trim() || null,
      authorsHtml: null,
      hasText: product.is_text === 1,
      hasVoice: product.is_sound === 1,
      hasTextures: product.is_texture === 1,
      hasSongs: product.is_song === 1,
      hasNeuralVoice: false,
      hasNeuralDub: false,
      hasNeuralText: false,
      version,
      updatedAt,
      size: null,
      mirrors: this.collectMirrors(product),
      stores: this.collectStores(product),
      howToInstallHtml: product.instruction?.trim() || null,
      directAvailable: false,
      inDevelopment: product.is_develop === 1,
      archivePassword: null,
    };
  }

  private static collectStores(
    product: GamesVoiceProduct
  ): LocalizationStore[] {
    return (product.stores ?? [])
      .filter((store) => store.link)
      .map((store) => ({
        name: store.name,
        iconUrl: store.img,
        url: store.link,
      }));
  }

  private static collectMirrors(
    product: GamesVoiceProduct
  ): LocalizationMirror[] {
    const mirrors: LocalizationMirror[] = [];

    if (product.file)
      mirrors.push({ label: "С сайта", url: product.file, kind: "direct" });
    if (product.yandex_link)
      mirrors.push({
        label: "Яндекс.Диск",
        url: product.yandex_link,
        kind: "yandex",
      });
    if (product.google_link)
      mirrors.push({
        label: "Google Drive",
        url: product.google_link,
        kind: "google",
      });
    if (product.mail_link)
      mirrors.push({
        label: "Облако Mail.ru",
        url: product.mail_link,
        kind: "mail",
      });

    return mirrors;
  }

  private static parseLatestUpdate(updatesHtml: string | null): {
    version: string | null;
    updatedAt: string | null;
  } {
    if (!updatesHtml) return { version: null, updatedAt: null };

    const latestEntry = updatesHtml.match(
      /(\d+(?:\.\d+)?)\s+от\s+(\d{1,2}\.\d{1,2}\.\d{4})/
    );
    if (!latestEntry) return { version: null, updatedAt: null };

    return { version: latestEntry[1], updatedAt: latestEntry[2] };
  }
}
