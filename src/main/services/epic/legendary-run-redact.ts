/**
 * Fork: strips secrets from Legendary command lines and output before they are
 * logged (see legendary-run-log.ts). Sessions, exchange codes and bearer tokens
 * must never reach the log. Dependency-free so it can be unit-tested.
 */

const SECRET_ARGUMENTS = new Set(["--code", "--token", "--sid", "--auth-code"]);

type SecretReplacement = string | ((match: string) => string);

const SECRET_PATTERNS: [RegExp, SecretReplacement][] = [
  // JSON fields of user.json / OAuth responses.
  [
    /("(?:access_token|refresh_token|id_token|exchange_code|code|sid|authorization)"\s*:\s*")[^"]*(")/gi,
    "$1<hidden>$2",
  ],
  // Query / form parameters.
  [
    /\b(code|exchangeCode|exchange_code|sid|access_token|refresh_token|token)=([^&\s"']+)/gi,
    "$1=<hidden>",
  ],
  // Authorization headers.
  [/\b(bearer|basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, "$1 <hidden>"],
  // Epic EG1 tokens and JWTs.
  [/\beg1~[A-Za-z0-9._~+/=-]+/gi, "<hidden-token>"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<hidden-token>"],
  // Long opaque secrets (exchange codes are 32 hex chars, refresh tokens longer).
  [/\b[a-f0-9]{32,}\b/gi, (match) => `<hex:${match.length}>`],
];

export const redactLegendaryText = (text: string) =>
  SECRET_PATTERNS.reduce(
    (result, [pattern, replacement]) =>
      typeof replacement === "string"
        ? result.replace(pattern, replacement)
        : result.replace(pattern, replacement),
    text
  );

export const describeLegendaryArgs = (args: readonly string[]) =>
  args
    .map((argument, index) =>
      index > 0 && SECRET_ARGUMENTS.has(args[index - 1])
        ? "<hidden>"
        : redactLegendaryText(argument)
    )
    .join(" ");
