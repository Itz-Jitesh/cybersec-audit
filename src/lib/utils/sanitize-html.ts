/**
 * Allow-list sanitiser for the rich text this app stores.
 *
 * Why this exists: comment and description HTML arrives from the client as a
 * plain string. The zod schema checks only its length, so anything that can
 * make an authenticated request can post arbitrary markup, and the comment
 * renderer puts it straight into the DOM. That is stored XSS against every
 * member who later opens the issue. TipTap's schema constrains what its own
 * editor produces; it constrains nothing about what a crafted request sends.
 *
 * The approach is deliberately narrow. Rather than trying to parse and repair
 * arbitrary HTML, every tag is rebuilt from scratch: an element survives only
 * if its name is on the list, and it keeps only the attributes named for that
 * element, with each value re-validated and re-escaped. Anything unrecognised
 * is dropped. There is no path by which an attribute the sanitiser did not
 * write can reach the output.
 *
 * A vetted library — DOMPurify or sanitize-html — remains the better long-term
 * answer, and swapping this out is a small change because everything funnels
 * through sanitizeRichText. It is not used here because adding a dependency
 * needs sign-off under the project's rules, and leaving a live hole open while
 * waiting for that would be the worse trade.
 */

/** Tags TipTap emits with the extension set configured in rich-editor.tsx. */
const ALLOWED_TAGS = new Set([
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
const DROP_WITH_CONTENT = [
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

const VOID_TAGS = new Set(["br", "hr"]);

/** Per-tag attribute allow-list. Everything else is discarded. */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href"]),
  span: new Set(["class", "data-mention-id"]),
  li: new Set(["data-checked"]),
  ul: new Set(["data-type"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
};

const UUID =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Characters a browser ignores inside a URL but a naive prefix check does not:
 * C0 controls, tab, newline, and the invisible spaces. "java\tscript:" is a
 * working link in every browser and does not start with "javascript:".
 */
const URL_NOISE =
  /[\u0000-\u0020\u00a0\u1680\u2000-\u200f\u2028\u2029\u202f\u205f\u3000\ufeff]/g;

function decodeHtmlEntities(value: string): string {
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

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Reads attributes out of a raw tag body without trusting order or quoting. */
function parseAttributes(source: string): Map<string, string> {
  const attributes = new Map<string, string>();
  const pattern =
    /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const name = match[1].toLowerCase();
    let value = match[2] ?? "";
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    attributes.set(name, value);
  }

  return attributes;
}

function rebuildTag(
  tag: string,
  rawAttributes: string,
  closing: boolean,
): string {
  if (closing) return VOID_TAGS.has(tag) ? "" : `</${tag}>`;

  const allowed = ALLOWED_ATTRS[tag];
  const kept: string[] = [];

  if (allowed) {
    for (const [name, value] of parseAttributes(rawAttributes)) {
      if (!allowed.has(name)) continue;
      if (name === "href" && !isSafeUrl(value)) continue;
      if (name === "data-mention-id" && !UUID.test(value)) continue;

      // class is allow-listed per tag but its value is still free text, so it
      // is escaped like everything else rather than trusted.
      kept.push(`${name}="${escapeAttribute(value)}"`);
    }
  }

  // A link that survives leaves this origin, so it gets the attributes that
  // stop the target page reaching back through window.opener.
  if (tag === "a" && kept.some((attr) => attr.startsWith("href="))) {
    kept.push('target="_blank"', 'rel="noopener noreferrer nofollow"');
  }

  const attrs = kept.length > 0 ? ` ${kept.join(" ")}` : "";
  return VOID_TAGS.has(tag) ? `<${tag}${attrs} />` : `<${tag}${attrs}>`;
}

/**
 * Returns HTML containing only allow-listed elements and attributes.
 *
 * Disallowed elements are unwrapped rather than deleted — their text survives,
 * so a paste does not silently lose content — except for those in
 * DROP_WITH_CONTENT, where the content is the thing being defended against.
 */
export function sanitizeRichText(input: string): string {
  let html = input;

  for (const tag of DROP_WITH_CONTENT) {
    html = html.replace(
      new RegExp(`<${tag}\\b[\\s\\S]*?<\\/${tag}\\s*>`, "gi"),
      "",
    );
    // An unclosed one would otherwise leave its opening tag behind.
    html = html.replace(new RegExp(`<\\/?${tag}\\b[^>]*>`, "gi"), "");
  }

  // Comments can hide markup from a naive pass and carry conditional syntax.
  html = html.replace(/<!--[\s\S]*?-->/g, "");

  return html.replace(
    /<\s*(\/)?\s*([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g,
    (
      _match: string,
      slash: string | undefined,
      rawTag: string,
      rawAttributes: string,
    ) => {
      const tag = rawTag.toLowerCase();
      if (!ALLOWED_TAGS.has(tag)) return "";
      return rebuildTag(tag, rawAttributes ?? "", slash === "/");
    },
  );
}

/** True when the document carries nothing but markup and whitespace. */
export function isEmptyRichText(html: string): boolean {
  return (
    html
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim().length === 0
  );
}
