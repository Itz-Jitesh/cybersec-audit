/**
 * Server-side sanitiser.
 *
 * This used isomorphic-dompurify, which is a wrapper around jsdom, and that is
 * why it is not DOMPurify any more. jsdom's CommonJS entry `require()`s ESM
 * dependencies — @exodus/bytes by way of html-encoding-sniffer — and Vercel's
 * module loader refuses that:
 *
 *   ERR_REQUIRE_ESM: require() of ES Module @exodus/bytes/encoding-lite.js
 *   from html-encoding-sniffer/lib/html-encoding-sniffer.js not supported
 *       at <unknown> (/opt/rust/nodejs.js:2:14482)
 *
 * The throw happens at module scope, so it took down every action in
 * src/actions/comments.ts and src/actions/issues.ts at once — comment, react,
 * subscribe, unsubscribe, state changes — for every role, with a healthy
 * database behind them. Node 24 does not help: that stack frame is Vercel's own
 * loader, not Node's, and it does not implement require(esm) at any version.
 * Pinning jsdom back only moves the failure to the next ESM package in its tree.
 *
 * sanitize-html parses with htmlparser2 instead of building a DOM, so nothing in
 * the chain needs a browser environment and nothing in it is ESM-only. It is
 * pinned to 2.14.0 deliberately: 2.15 moved to htmlparser2 v12, which is
 * ESM-only and reintroduces exactly the failure above.
 *
 * The allow-lists, the exported API and its test suite are unchanged — that is
 * the point. The engine underneath them moved and the contract did not.
 *
 * The client keeps using dompurify directly against the browser's own DOM; see
 * ./sanitize-html-client.ts. Client Components must never import this file.
 */

import sanitizeHtml from "sanitize-html";

import {
  ALLOWED_ATTRS,
  ALLOWED_TAGS,
  DROP_WITH_CONTENT,
  isSafeUrl,
  UUID,
} from "./sanitize-html-core.ts";

/**
 * The per-tag rules, in the shape sanitize-html wants: tag name to attribute
 * list. The project's own ALLOWED_ATTRS is already per-tag, so this is a direct
 * translation rather than the global-list-plus-hook dance DOMPurify needed.
 */
const ALLOWED_ATTRIBUTES: Record<string, string[]> = Object.fromEntries(
  Object.entries(ALLOWED_ATTRS).map(([tag, attributes]) => [
    tag,
    [...attributes],
  ]),
);

/**
 * Strip everything not on the allow-list.
 *
 * Disallowed elements are unwrapped rather than deleted — their text survives,
 * so a paste does not silently lose content — except for those in
 * DROP_WITH_CONTENT, where the content is the thing being defended against.
 * That is `disallowedTagsMode: "discard"` plus `nonTextTags`, which together
 * reproduce DOMPurify's KEEP_CONTENT and FORBID_CONTENTS behaviour.
 */
export function sanitizeRichText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [...ALLOWED_TAGS],
    allowedAttributes: ALLOWED_ATTRIBUTES,
    // Unwrap unknown tags, keeping their text.
    disallowedTagsMode: "discard",
    // ...except these, which are dropped with everything inside them.
    nonTextTags: DROP_WITH_CONTENT,
    // The href check is this project's own: sanitize-html's allowedSchemes
    // would not catch `java&#115;cript:` or `java\tscript:`, and isSafeUrl has
    // its own assertions for exactly those.
    allowedSchemes: ["http", "https", "mailto"],
    allowProtocolRelative: false,
    transformTags: {
      a: (tagName, attribs) => {
        const href = attribs.href;
        if (href !== undefined && !isSafeUrl(href)) {
          const rest = { ...attribs };
          delete rest.href;
          return { tagName, attribs: rest };
        }
        return { tagName, attribs };
      },
      span: (tagName, attribs) => {
        // A mention id is rendered into markup other members read, so it has to
        // be a uuid and not an arbitrary string.
        const id = attribs["data-mention-id"];
        if (id !== undefined && !UUID.test(id)) {
          const rest = { ...attribs };
          delete rest["data-mention-id"];
          return { tagName, attribs: rest };
        }
        return { tagName, attribs };
      },
    },
  });
}
