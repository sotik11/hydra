import assert from "node:assert/strict";
import test from "node:test";
import {
  describeLegendaryArgs,
  redactLegendaryText,
} from "./legendary-run-redact.ts";

const exchangeCode = "0123456789abcdef0123456789abcdef";

test("secret arguments are hidden in the logged command", () => {
  assert.equal(
    describeLegendaryArgs([
      "--api-timeout",
      "15",
      "auth",
      "--code",
      exchangeCode,
    ]),
    "--api-timeout 15 auth --code <hidden>"
  );
  assert.equal(
    describeLegendaryArgs(["list", "--json", "--platform", "Windows"]),
    "list --json --platform Windows"
  );
});

test("tokens and codes never survive redaction", () => {
  const text = [
    `{"access_token": "eg1~abc.def", "refresh_token": "eg1~zzz", "displayName": "Sotik11"}`,
    `GET https://example.test/id?code=${exchangeCode}&state=1`,
    "Authorization: bearer abcdefgh12345678",
    "jwt eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.c2lnbmF0dXJl",
    `exchange ${exchangeCode}`,
  ].join("\n");
  const redacted = redactLegendaryText(text);

  for (const secret of [
    "eg1~abc.def",
    "eg1~zzz",
    exchangeCode,
    "abcdefgh12345678",
    "eyJhbGciOiJIUzI1NiJ9",
  ]) {
    assert.equal(redacted.includes(secret), false, secret);
  }
  assert.match(redacted, /Sotik11/);
  assert.match(redacted, /state=1/);
});
