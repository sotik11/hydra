import axios from "axios";
import crypto from "node:crypto";
import { app } from "electron";
import type {
  GameLocalization,
  GameShop,
  LocalizationFile,
  LocalizationFileEntry,
  LocalizationSource,
  LocalizationSourceCategory,
  LocalizationSourceGame,
} from "@types";
import { db, levelKeys, localizationSourcesSublevel } from "@main/level";
import { logger } from "@main/services";
import {
  GamesVoiceAdapter,
  type LocalizationQuery,
} from "./gamesvoice-adapter";
import { builtinProviders, type LocalizationProvider } from "./provider";
import { createJsonProvider, parseLocalizationFile } from "./json-adapter";
import {
  DEFAULT_SOURCES_FEED_BASE,
  DEFAULT_SOURCES_MANIFEST_URL,
  GAMESVOICE_LOCALE,
  GAMESVOICE_PROVIDER_ID,
} from "./constants";

interface DefaultSourceSeedMeta {
  seededUrls: string[];
  localeApplied: boolean;
}

// aggregates lookups across enabled providers — builtin studios + user json sources;
// everything lives in the localization-sources sublevel, builtins seeded on first access
export class LocalizationService {
  // seeds builtins on first access and reconciles their metadata each call, so older
  // records pick up new fields — the user's enabled choice is always kept
  public static async getSources(): Promise<LocalizationSource[]> {
    const stored = await localizationSourcesSublevel.values().all();
    const byId = new Map(stored.map((source) => [source.id, source]));

    for (const provider of builtinProviders) {
      const existing = byId.get(provider.id);

      if (!existing) {
        const record: LocalizationSource = {
          id: provider.id,
          name: provider.name,
          type: "builtin",
          enabled: provider.enabledByDefault,
          addedAt: new Date().toISOString(),
          url: provider.url,
          language: provider.language,
          category: provider.category,
        };

        await localizationSourcesSublevel.put(provider.id, record);
        byId.set(provider.id, record);
      } else if (
        existing.name !== provider.name ||
        existing.url !== provider.url ||
        existing.language !== provider.language ||
        existing.category !== provider.category
      ) {
        const reconciled: LocalizationSource = {
          ...existing,
          name: provider.name,
          url: provider.url,
          language: provider.language,
          category: provider.category,
        };

        await localizationSourcesSublevel.put(provider.id, reconciled);
        byId.set(provider.id, reconciled);
      }
    }

    return Array.from(byId.values());
  }

  public static async search(
    query: LocalizationQuery
  ): Promise<GameLocalization[]> {
    const sources = await this.getSources();
    const enabledIds = new Set(
      sources.filter((source) => source.enabled).map((source) => source.id)
    );

    const providers = this.resolveProviders(sources).filter((provider) =>
      enabledIds.has(provider.id)
    );

    const resultsPerProvider = await Promise.all(
      providers.map((provider) => provider.search(query))
    );

    return resultsPerProvider.flat();
  }

  private static resolveProviders(
    sources: LocalizationSource[]
  ): LocalizationProvider[] {
    const jsonProviders = sources
      .filter((source) => source.type === "json")
      .map((source) => createJsonProvider(source));

    return [...builtinProviders, ...jsonProviders];
  }

  // games a source covers, for the Settings link — json from cached entries,
  // builtin from its live catalogue (only ones resolvable to a store page)
  public static async getSourceGames(
    id: string
  ): Promise<LocalizationSourceGame[]> {
    const sources = await this.getSources();
    const source = sources.find((candidate) => candidate.id === id);
    if (!source) return [];

    if (source.type === "json") {
      return (source.entries ?? [])
        .filter((entry) => entry.steamAppId)
        .map((entry) => ({
          shop: "steam" as GameShop,
          objectId: entry.steamAppId!,
          title: entry.title,
        }));
    }

    const provider = builtinProviders.find((candidate) => candidate.id === id);
    return provider?.listGames ? provider.listGames() : [];
  }

  public static async addJsonSource(
    url: string,
    enabled = true
  ): Promise<LocalizationSource> {
    const existing = await localizationSourcesSublevel.values().all();
    if (
      existing.some((source) => source.type === "json" && source.url === url)
    ) {
      throw new Error("Localization source with this URL already exists");
    }

    const { name, language, category, siteUrl, entries, fingerprint } =
      await this.fetchJsonSource(url);
    const now = new Date().toISOString();

    const source: LocalizationSource = {
      id: crypto.randomUUID(),
      name,
      type: "json",
      enabled,
      addedAt: now,
      url,
      language,
      category,
      siteUrl,
      fingerprint,
      syncedAt: now,
      entries,
    };

    await localizationSourcesSublevel.put(source.id, source);
    return source;
  }

  // dist build only: on first run, seed the feed's default json sources (all disabled),
  // then enable the ones whose locale matches the user's Hydra language. A "seeded" set is
  // tracked so a removed default never comes back, manual re-adds still work, and later
  // manifest additions get added (disabled) on subsequent runs.
  public static async seedDefaultSources(): Promise<void> {
    if (!DEFAULT_SOURCES_MANIFEST_URL) return;

    const meta = await this.getSeedMeta();
    const firstRun = !meta.localeApplied;
    const userLocale = await this.resolveUserLocale();

    // make sure the builtin records exist before we maybe toggle GamesVoice
    await this.getSources();

    let manifest: { file: string; locale: string }[];
    try {
      const response = await axios.get<unknown>(DEFAULT_SOURCES_MANIFEST_URL, {
        timeout: 15000,
      });
      manifest = Array.isArray(response.data)
        ? (response.data as { file: string; locale: string }[])
        : [];
    } catch (error) {
      // leave firstRun intact so the locale seed retries on the next launch
      logger.error(
        "[Localization] Failed to fetch default sources manifest:",
        error
      );
      return;
    }

    const seeded = new Set(meta.seededUrls);
    const stored = await localizationSourcesSublevel.values().all();
    const presentUrls = new Set(
      stored
        .filter((source) => source.type === "json")
        .map((source) => source.url)
    );

    for (const { file, locale } of manifest) {
      const url = `${DEFAULT_SOURCES_FEED_BASE}/${file}`;
      if (seeded.has(url)) continue; // already offered — never re-add (respects removal)
      if (presentUrls.has(url)) {
        seeded.add(url); // user already added it by hand — just remember it
        continue;
      }

      try {
        await this.addJsonSource(
          url,
          firstRun && this.localeMatches(userLocale, locale)
        );
        seeded.add(url);
      } catch (error) {
        // leave it unseeded so it retries next launch
        logger.error(
          "[Localization] Failed to seed default source:",
          url,
          error
        );
      }
    }

    // GamesVoice is a builtin — enable it on first run for Russian-speaking users
    if (firstRun && this.localeMatches(userLocale, GAMESVOICE_LOCALE)) {
      await this.setSourceEnabled(GAMESVOICE_PROVIDER_ID, true);
    }

    await this.setSeedMeta({ seededUrls: [...seeded], localeApplied: true });
  }

  // the user's language at first run: the saved Hydra language if set, otherwise the OS
  // locale (available immediately, before the renderer has picked/persisted a language)
  private static async resolveUserLocale(): Promise<string> {
    try {
      const saved = await db.get<string, string>(levelKeys.language, {
        valueEncoding: "utf8",
      });
      if (saved) return saved.replaceAll('"', "");
    } catch {
      // not set yet on a fresh install — fall through to the OS locale
    }
    return app.getLocale();
  }

  // "ru" matches "ru" or "ru-RU"; a region-specific manifest locale ("pt-BR") needs exact
  private static localeMatches(
    userLocale: string,
    sourceLocale: string
  ): boolean {
    const user = userLocale.toLowerCase();
    const source = sourceLocale.toLowerCase();
    if (source.includes("-")) return user === source;
    return user === source || user.split("-")[0] === source;
  }

  private static async getSeedMeta(): Promise<DefaultSourceSeedMeta> {
    try {
      const meta = await db.get<string, DefaultSourceSeedMeta>(
        levelKeys.localizationSeedMeta,
        { valueEncoding: "json" }
      );
      return {
        seededUrls: Array.isArray(meta?.seededUrls) ? meta.seededUrls : [],
        localeApplied: Boolean(meta?.localeApplied),
      };
    } catch {
      return { seededUrls: [], localeApplied: false };
    }
  }

  private static async setSeedMeta(meta: DefaultSourceSeedMeta): Promise<void> {
    await db.put(levelKeys.localizationSeedMeta, meta, {
      valueEncoding: "json",
    });
  }

  public static async removeSource(id: string): Promise<void> {
    await localizationSourcesSublevel.del(id);
  }

  public static async setSourceEnabled(
    id: string,
    enabled: boolean
  ): Promise<void> {
    const source = await localizationSourcesSublevel.get(id);
    if (!source) return;

    await localizationSourcesSublevel.put(id, { ...source, enabled });
  }

  public static async syncJsonSources(): Promise<void> {
    const sources = await localizationSourcesSublevel.values().all();

    for (const source of sources) {
      if (source.type !== "json" || !source.url) continue;

      try {
        const { name, language, category, siteUrl, entries, fingerprint } =
          await this.fetchJsonSource(source.url);

        await localizationSourcesSublevel.put(source.id, {
          ...source,
          name,
          language,
          category,
          siteUrl,
          entries,
          fingerprint,
          syncedAt: new Date().toISOString(),
        });
      } catch (error) {
        logger.error(
          "[Localization] Failed to sync source:",
          source.url,
          error
        );
      }
    }
  }

  private static async fetchJsonSource(url: string): Promise<{
    name: string;
    language?: string;
    category?: LocalizationSourceCategory;
    siteUrl?: string;
    entries: LocalizationFileEntry[];
    fingerprint: string;
  }> {
    const response = await axios.get<unknown>(url, { timeout: 15000 });
    const raw = response.data;

    const entries = parseLocalizationFile(raw);
    const file =
      raw && typeof raw === "object" ? (raw as Partial<LocalizationFile>) : {};

    const fileName = typeof file.name === "string" ? file.name : url;

    // Source language: explicit file field, else the first entry that has one.
    const language =
      typeof file.language === "string" && file.language
        ? file.language
        : entries.find((entry) => entry.language)?.language;

    const category = (
      ["studio", "neural-studio", "aggregator"] as const
    ).includes(file.category as LocalizationSourceCategory)
      ? file.category
      : undefined;

    const siteUrl = typeof file.siteUrl === "string" ? file.siteUrl : undefined;

    const fingerprint = crypto
      .createHash("sha256")
      .update(JSON.stringify(raw))
      .digest("hex");

    return {
      name: fileName,
      language,
      category,
      siteUrl,
      entries,
      fingerprint,
    };
  }
}

export { GamesVoiceAdapter };
export type { LocalizationQuery };
