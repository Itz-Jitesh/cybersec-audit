/**
 * Server-side sanitiser.  Uses isomorphic-dompurify which wraps jsdom — this
 * file must NEVER be imported by a Client Component because Turbopack cannot
 * resolve jsdom's fs.readFileSync paths when bundling for the browser.
 */

import DOMPurify from "isomorphic-dompurify";

import {
  ALLOWED_ATTRS,
  ALLOWED_TAGS,
  DROP_WITH_CONTENT,
  GLOBAL_ATTRS,
  isSafeUrl,
  UUID,
} from "./sanitize-html-core.ts";

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
    KEEP_CONTENT: true,
    FORBID_CONTENTS: DROP_WITH_CONTENT,
    ALLOW_DATA_ATTR: true,
    ALLOW_ARIA_ATTR: false,
  });
}
