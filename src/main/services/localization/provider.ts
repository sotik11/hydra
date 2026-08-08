import type {
  GameLocalization,
  LocalizationSourceCategory,
  LocalizationSourceGame,
} from "@types";
import {
  GamesVoiceAdapter,
  type LocalizationQuery,
} from "./gamesvoice-adapter";
import {
  GAMESVOICE_PROVIDER_ID,
  GAMESVOICE_ENABLED_BY_DEFAULT,
} from "./constants";

export interface LocalizationProvider {
  id: string;
  name: string;
  type: "builtin" | "json";
  search(query: LocalizationQuery): Promise<GameLocalization[]>;
  listGames?(): Promise<LocalizationSourceGame[]>;
}

export interface BuiltinLocalizationProvider extends LocalizationProvider {
  type: "builtin";
  enabledByDefault: boolean;
  url: string;
  language: string;
  category: LocalizationSourceCategory;
}

export const builtinProviders: BuiltinLocalizationProvider[] = [
  {
    id: GAMESVOICE_PROVIDER_ID,
    name: GamesVoiceAdapter.studioName,
    type: "builtin",
    enabledByDefault: GAMESVOICE_ENABLED_BY_DEFAULT,
    url: "https://www.gamesvoice.ru/library",
    language: GamesVoiceAdapter.language,
    category: "studio",
    search: (query) => GamesVoiceAdapter.search(query),
    listGames: () => GamesVoiceAdapter.listGames(),
  },
];
