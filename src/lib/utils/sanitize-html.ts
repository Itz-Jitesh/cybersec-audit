/**
 * Allow-list sanitiser for the rich text this app stores.
 *
 * Why this exists: comment, description and page HTML arrives from the client
 * as a plain string. The zod schema checks only its length, so anything that
 * can make an authenticated request can post arbitrary markup, and the comment
 * renderer puts it straight into the DOM. That is stored XSS against every
 * member who later opens the issue. TipTap's schema constrains what its own
 * editor produces; it constrains nothing about what a crafted request sends.
 *
 * The engine is DOMPurify, which parses the input with a real HTML parser and
 * walks the resulting tree. The hand-rolled version this replaces rebuilt
 * every tag from a regular expression over the raw string — defensible as a
 * stop-gap while a dependency was waiting on sign-off, but a parser written in
 * regular expressions is the wrong tool for a security boundary: mutation XSS
 * turns on exactly the disagreements between such a pass and the browser's own
 * parser, and only the browser's parser knows what the browser will do.
 *
 * The allow-lists below are unchanged, and so is the exported API and its test
 * suite, which is the point — the tests describe the contract and the engine
 * underneath them moved.
 *
 * isSafeUrl stays hand-written. DOMPurify vets hrefs inside HTML for us, but
 * issue links are stored as bare URL strings with no markup around them, and
 * that check has its own assertions.
 */

import DOMPurify from "isomorphic-dompurify";

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
/**
 * The per-tag attribute rules, applied after DOMPurify's own pass.
 *
 * DOMPurify's ALLOWED_ATTR is global — permit `class` and every allowed tag
 * may carry it. This project's rules are per-tag, so the global list is the
 * union and this hook then removes anything not named for the element it
 * actually landed on. A mention id is additionally required to be a uuid,
 * since it is rendered into markup that other members read.
 */
const GLOBAL_ATTRS = [
  ...new Set(
    Object.values(ALLOWED_ATTRS).flatMap((set) => [...set]),
  ),
];

let hookInstalled = false;

function installHook(): void {
  if (hookInstalled) return;
  hookInstalled = true;

  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    const element = node as Element;
    if (!element.tagName) return;

    const tag = element.tagName.toLowerCase();
    const permitted = ALLOWED_ATTRS[tag];

    for (const attribute of [...element.attributes]) {
      const name = attribute.name.toLowerCase();

      if (!permitted?.has(name)) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "data-mention-id" && !UUID.test(attribute.value)) {
        element.removeAttribute(attribute.name);
        continue;
      }

      if (name === "href" && !isSafeUrl(attribute.value)) {
        element.removeAttribute(attribute.name);
      }
    }
  });
}

/**
 * Strip everything not on the allow-list.
 *
 * Disallowed elements are unwrapped rather than deleted — their text survives,
 * so a paste does not silently lose content — except for those in
 * DROP_WITH_CONTENT, where the content is the thing being defended against.
 * That is DOMPurify's default behaviour for KEEP_CONTENT plus FORBID_CONTENTS,
 * which is why both lists carry over unchanged.
 */
export function sanitizeRichText(input: string): string {
  installHook();

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [...ALLOWED_TAGS],
    ALLOWED_ATTR: GLOBAL_ATTRS,
    // Unwrap unknown elements, keeping their text.
    KEEP_CONTENT: true,
    // …except these, where the content is the payload.
    FORBID_CONTENTS: DROP_WITH_CONTENT,
    // data-* has to survive DOMPurify's own pass, because three of the
    // allow-listed attributes are data attributes — a mention id, a task-list
    // checkbox and a list type. The hook above is what narrows them again:
    // anything not named for the element it landed on is removed there, so
    // this is permissive at the parser and strict at the tree.
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: false,
    // USE_PROFILES is deliberately absent. Setting it replaces ALLOWED_TAGS
    // with the profile's own much larger list, which let <form> and <button>
    // straight through — caught by the form-injection assertion.
  });
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
