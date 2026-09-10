/**
 * Shared sanitisation constants and helpers used by both the server and client
 * modules.  DOMPurify itself is NOT imported here — each consumer brings its
 * own instance so that the server can use isomorphic-dompurify (jsdom) and the
 * client can use dompurify directly (browser DOM).
 */

/** Tags TipTap emits with the extension set configured in rich-editor.tsx. */
export const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "strong",
  "b",
  "em",
  "i",
  "s",
  "u",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "a",
  "span",
  "hr",
]);

/** Elements whose content is the payload and must go with them. */
export const DROP_WITH_CONTENT = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "template",
  "noscript",
  "svg",
  "math",
  "title",
];

/** Per-tag attribute allow-list. Everything else is discarded. */
export const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href"]),
  span: new Set(["class", "data-mention-id"]),
  li: new Set(["data-checked"]),
  ul: new Set(["data-type"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
};

export const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Characters a browser ignores inside a URL but a naive prefix check does not:
 * C0 controls, tab, newline, and the invisible spaces. "java\tscript:" is a
 * working link in every browser and does not start with "javascript:".
 */
export const URL_NOISE =
  /[\u0000-\u0020\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]/g;

export function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);?/g, (_, dec: string) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&amp;/gi, "&")
    .replace(/&colon;/gi, ":")
    .replace(/&tab;/gi, "\t")
    .replace(/&newline;/gi, "\n");
}

/**
 * Only http, https and mailto survive, plus same-document references.
 * javascript: and data: are the two that turn a link into script execution and
 * neither has a legitimate use here.
 *
 * The value is decoded and stripped of the noise above first, because
 * `java&#115;cript:` is the standard way past a plain prefix check.
 */
export function isSafeUrl(raw: string): boolean {
  const decoded = decodeHtmlEntities(raw).replace(URL_NOISE, "").toLowerCase();

  if (decoded.startsWith("/") || decoded.startsWith("#")) return true;

  return (
    decoded.startsWith("http://") ||
    decoded.startsWith("https://") ||
    decoded.startsWith("mailto:")
  );
}

/**
 * The per-tag attribute rules, applied after DOMPurify's own pass.
 *
 * DOMPurify's ALLOWED_ATTR is global — permit `class` and every allowed tag
 * may carry it. This project's rules are per-tag, so the global list is the
 * union and this hook then removes anything not named for the element it
 * actually landed on. A mention id is additionally required to be a uuid,
 * since it is rendered into markup that other members read.
 */
export const GLOBAL_ATTRS = [
  ...new Set(
    Object.values(ALLOWED_ATTRS).flatMap((set) => [...set]),
  ),
];

/** True when the document carries nothing but markup and whitespace. */
export function isEmptyRichText(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim().length === 0
  );
}
