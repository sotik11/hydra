import assert from "node:assert/strict";
import { describe, it } from "node:test";

// @ts-ignore The Node ESM test runner requires the source extension.
import {
  clampCoverSize,
  columnsForCoverSize,
  coverSizeForColumns,
} from "./library-cover-size.ts";

describe("library cover size", () => {
  it("clamps and snaps to the slider step", () => {
    assert.equal(clampCoverSize(10), 120);
    assert.equal(clampCoverSize(999), 360);
    assert.equal(clampCoverSize(204), 200);
    assert.equal(clampCoverSize(206), 210);
  });

  it("fits as many columns as the width allows", () => {
    // 7 covers of 200 px + 6 gaps of 16 px = 1496 px.
    assert.equal(columnsForCoverSize(1496, 200, 16), 7);
    assert.equal(columnsForCoverSize(1495, 200, 16), 6);
    assert.equal(columnsForCoverSize(100, 360, 16), 1);
  });

  it("round-trips a preset column count", () => {
    const width = 1700;
    const size = coverSizeForColumns(width, 7, 16);
    assert.equal(columnsForCoverSize(width, size, 16), 7);
  });
});
