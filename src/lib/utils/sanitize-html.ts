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
 * The engine is sanitize-html on the server and DOMPurify in the browser. Both
 * parse the input with a real HTML parser and walk the resulting tree. The hand-rolled version this replaces rebuilt
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
 *
 * ---
 * This file re-exports from the core (shared logic) and server (DOMPurify via
 * sanitize-html) modules.  Client Components must NOT import from this file —
 * use ./sanitize-html-client.ts instead. Nothing here reaches for a DOM any
 * more, but the split is still what keeps the server parser out of the browser
 * bundle.
 */

export { isEmptyRichText, isSafeUrl } from "./sanitize-html-core.ts";
export { sanitizeRichText } from "./sanitize-html-server.ts";
