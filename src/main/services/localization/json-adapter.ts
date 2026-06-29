import type {
  GameLocalization,
  LocalizationFile,
  LocalizationFileEntry,
  LocalizationSource,
} from "@types";
import type { LocalizationQuery } from "./gamesvoice-adapter";
import type { LocalizationProvider } from "./provider";
import { isDirectLinkAvailable } from "./link-probe";

const DEFAULT_LANGUAGE = "Русский";

function normalizeTitle(title: string | null | undefined): string {
  if (!title) return "";
  return title
    .toLowerCase()
    .replace(/['’:.,!?®™–—-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function entryMatchesQuery(
  entry: LocalizationFileEntry,
  query: LocalizationQuery
): boolean {
  if (
    query.shop === "steam" &&
    entry.steamAppId &&
    entry.steamAppId === query.objectId
  ) {
    return true;
  }

  const queryTitle = normalizeTitle(query.title);
  return queryTitle.length > 0 && normalizeTitle(entry.title) === queryTitle;
}

function toGameLocalization(
  entry: LocalizationFileEntry,
  sourceName: string
): GameLocalization {
  return {
    studio: entry.studio || sourceName,
    studioUrl: entry.studioUrl ?? "",
    language: entry.language ?? DEFAULT_LANGUAGE,
    title: entry.title,
    pageUrl: entry.pageUrl ?? entry.studioUrl ?? "",
    changelogHtml: entry.changelogHtml ?? null,
    authorsHtml: entry.authorsHtml ?? null,
    hasText: entry.hasText ?? false,
    hasVoice: entry.hasVoice ?? false,
    hasTextures: entry.hasTextures ?? false,
    hasSongs: entry.hasSongs ?? false,
    hasNeuralVoice: entry.hasNeuralVoice ?? false,
    hasNeuralDub: entry.hasNeuralDub ?? false,
    hasNeuralText: entry.hasNeuralText ?? false,
    version: entry.version ?? null,
    updatedAt: entry.updatedAt ?? null,
    size: entry.size ?? null,
    mirrors: entry.mirrors ?? [],
    stores: entry.stores ?? [],
    howToInstallHtml: entry.howToInstallHtml ?? null,
    directAvailable: false, // set later by the live link probe
    inDevelopment: entry.inDevelopment ?? false,
    requiredGameVersion: entry.requiredGameVersion ?? null,
  };
}

export function parseLocalizationFile(raw: unknown): LocalizationFileEntry[] {
  if (!raw || typeof raw !== "object") {
    throw new Error("Localization file is not a JSON object");
  }

  const file = raw as Partial<LocalizationFile>;
  if (!Array.isArray(file.localizations)) {
    throw new Error("Localization file is missing a `localizations` array");
  }

  return file.localizations.filter(
    (entry): entry is LocalizationFileEntry =>
      !!entry &&
      typeof entry === "object" &&
      typeof (entry as LocalizationFileEntry).title === "string" &&
      typeof (entry as LocalizationFileEntry).studio === "string"
  );
}

export function createJsonProvider(
  source: LocalizationSource
): LocalizationProvider {
  return {
    id: source.id,
    name: source.name,
    type: "json",
    async search(query) {
      const matched = (source.entries ?? []).filter((entry) =>
        entryMatchesQuery(entry, query)
      );

      return Promise.all(
        matched.map(async (entry) => {
          const localization = toGameLocalization(entry, source.name);
          const directMirror = localization.mirrors.find(
            (mirror) => mirror.kind === "direct"
          );
          localization.directAvailable = directMirror
            ? await isDirectLinkAvailable(directMirror.url)
            : false;
          return localization;
        })
      );
    },
  };
}
