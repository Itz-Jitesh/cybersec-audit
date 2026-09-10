"use client";

/**
 * Client-side sanitiser.  Uses dompurify directly against the browser DOM —
 * no jsdom, no fs.readFileSync, no ENOENT on Turbopack.  The hook and
 * allow-lists are identical to the server module so the contract is unchanged.
 */

import DOMPurify from "dompurify";

import {
  ALLOWED_ATTRS,
  ALLOWED_TAGS,
  DROP_WITH_CONTENT,
  GLOBAL_ATTRS,
  isSafeUrl,
  UUID,
} from "./sanitize-html-core";

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
 * Strip everything not on the allow-list — identical contract to the server
 * version, but runs against the real browser DOM.
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
