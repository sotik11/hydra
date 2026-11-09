import assert from "node:assert/strict";
import { describe, it } from "node:test";

// @ts-ignore The Node ESM test runner requires the source extension.
import {
  buildSteamAssetUrl,
  mergeReleaseCalendar,
  parseSteamPersonalCalendar,
  parseSteamSearchAppIds,
  precisionFromComingSoonDisplay,
  steamLanguageFor,
  type SteamStoreItem,
} from "./release-calendar-core.ts";

const NOW = 1_794_000_000;
const DAY = 86_400;

const storeItem = (
  appid: number,
  release: SteamStoreItem["release"],
  extra: Partial<SteamStoreItem> = {}
): SteamStoreItem => ({
  appid,
  name: `Game ${appid}`,
  type: 0,
  release,
  assets: {
    asset_url_format: `steam/apps/${appid}/\${FILENAME}?t=1`,
    library_capsule: "library_600x900.jpg",
  },
  ...extra,
});

describe("parseSteamPersonalCalendar", () => {
  it("reads arrAppInfos entries", () => {
    const raw = JSON.stringify({
      arrAppInfos: [
        {
          nAppID: 10,
          nReleaseDate: NOW,
          fWeight: 1.5,
          nRank: 3,
          bIsWishlisted: true,
          bIsOwned: false,
          bIsEarlyAccess: true,
        },
        { nAppID: 0, nReleaseDate: NOW },
        { nAppID: 11 },
      ],
    });
    assert.deepEqual(parseSteamPersonalCalendar(raw), [
      {
        appId: "10",
        releaseDate: NOW,
        weight: 1.5,
        rank: 3,
        isWishlisted: true,
        isOwned: false,
        isEarlyAccess: true,
      },
    ]);
  });

  it("returns null for missing or broken payloads", () => {
    assert.equal(parseSteamPersonalCalendar(null), null);
    assert.equal(parseSteamPersonalCalendar("not json"), null);
    assert.equal(parseSteamPersonalCalendar('{"other":1}'), null);
  });
});

describe("parseSteamSearchAppIds", () => {
  it("keeps single app ids in order, skips bundles and duplicates", () => {
    const html =
      '<a data-ds-appid="5"></a><a data-ds-appid="7,8"></a><a data-ds-appid="3"></a><a data-ds-appid="5"></a>';
    assert.deepEqual(parseSteamSearchAppIds(html), ["5", "3"]);
  });
});

describe("helpers", () => {
  it("maps coming soon display to precision", () => {
    assert.equal(precisionFromComingSoonDisplay("date_full"), "day");
    assert.equal(precisionFromComingSoonDisplay("date_month"), "month");
    assert.equal(precisionFromComingSoonDisplay("date_quarter"), "quarter");
    assert.equal(precisionFromComingSoonDisplay("date_year"), "year");
    assert.equal(precisionFromComingSoonDisplay(undefined), "day");
  });

  it("builds asset urls", () => {
    assert.equal(
      buildSteamAssetUrl("steam/apps/1/${FILENAME}?t=2", "header.jpg"),
      "https://shared.steamstatic.com/store_item_assets/steam/apps/1/header.jpg?t=2"
    );
    assert.equal(buildSteamAssetUrl(undefined, "header.jpg"), null);
  });

  it("maps i18n languages to Steam languages", () => {
    assert.equal(steamLanguageFor("uk"), "ukrainian");
    assert.equal(steamLanguageFor("pt-BR"), "brazilian");
    assert.equal(steamLanguageFor("ru-RU"), "russian");
    assert.equal(steamLanguageFor("xx"), "english");
  });
});

describe("mergeReleaseCalendar", () => {
  it("merges sources, flags and filters", () => {
    const items = new Map<string, SteamStoreItem>([
      [
        "1",
        storeItem(1, {
          steam_release_date: NOW + DAY,
          is_coming_soon: true,
          coming_soon_display: "date_full",
        }),
      ],
      [
        "2",
        storeItem(2, {
          steam_release_date: NOW + 30 * DAY,
          is_coming_soon: true,
          coming_soon_display: "date_quarter",
        }),
      ],
      ["3", storeItem(3, { steam_release_date: NOW - 400 * DAY })],
      ["4", storeItem(4, { steam_release_date: NOW + 2 * DAY }, { type: 4 })],
      [
        "5",
        storeItem(5, { steam_release_date: NOW + DAY, is_coming_soon: true }),
      ],
    ]);

    const games = mergeReleaseCalendar({
      items,
      personal: [
        {
          appId: "5",
          releaseDate: NOW + DAY,
          weight: 2,
          rank: 1,
          isWishlisted: false,
          isOwned: true,
          isEarlyAccess: false,
        },
      ],
      popularIds: ["1", "2", "4", "6"],
      wishlist: new Map([
        ["1", { isAvailable: true }],
        ["3", { isAvailable: false }],
      ]),
      now: NOW,
    });

    // 3 is too old, 4 is DLC, 6 has no store item.
    assert.deepEqual(
      games.map((game) => game.appId),
      ["1", "5", "2"]
    );

    const [wishlisted, personal, quarter] = games;
    assert.equal(wishlisted.isWishlisted, true);
    assert.equal(wishlisted.isAvailable, true);
    assert.equal(wishlisted.isPopular, true);
    assert.ok(wishlisted.weight > personal.weight);
    assert.equal(
      wishlisted.cover,
      "https://shared.steamstatic.com/store_item_assets/steam/apps/1/library_600x900.jpg?t=1"
    );

    assert.equal(personal.isPersonal, true);
    assert.equal(personal.isOwned, true);
    assert.equal(personal.isWishlisted, false);

    assert.equal(quarter.precision, "quarter");
  });
});
