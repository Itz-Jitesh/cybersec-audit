/**
 * Attack-vector suite for the rich text sanitiser.
 *
 *   pnpm test:sanitize
 *
 * Kept as a plain script rather than a Vitest file because Vitest is not among
 * the dependencies this project has approved, and a security control with no
 * test is a security control nobody can change safely.
 *
 * Every vector below is a payload that reached the DOM before the sanitiser
 * existed. Add to this list rather than replacing it.
 */

import { isSafeUrl, sanitizeRichText } from "./sanitize-html.ts";

interface Vector {
  input: string;
  /** A fragment that must not survive into the output. */
  forbidden: string;
  note: string;
}

const VECTORS: Vector[] = [
  {
    input: "<script>alert(1)</script>",
    forbidden: "script",
    note: "bare script",
  },
  {
    input: "<p>hi</p><script>alert(1)</script>",
    forbidden: "script",
    note: "script after legitimate content",
  },
  {
    input: "<img src=x onerror=alert(1)>",
    forbidden: "onerror",
    note: "unquoted event handler on a dropped tag",
  },
  {
    input: '<p onclick="alert(1)">x</p>',
    forbidden: "onclick",
    note: "event handler on an allowed tag",
  },
  {
    input: '<a href="javascript:alert(1)">x</a>',
    forbidden: "javascript",
    note: "javascript scheme",
  },
  {
    input: '<a href="JaVaScRiPt:alert(1)">x</a>',
    forbidden: "javascript",
    note: "mixed case scheme",
  },
  {
    input: '<a href="java&#115;cript:alert(1)">x</a>',
    forbidden: "javascript",
    note: "entity-encoded scheme",
  },
  {
    input: '<a href="java\tscript:alert(1)">x</a>',
    forbidden: "javascript",
    note: "tab inside the scheme",
  },
  {
    input: '<a href="&#106;avascript:alert(1)">x</a>',
    forbidden: "javascript",
    note: "numeric entity for the first character",
  },
  {
    input: '<a href="data:text/html,<script>alert(1)</script>">x</a>',
    forbidden: "data:",
    note: "data URL",
  },
  { input: "<svg onload=alert(1)>", forbidden: "onload", note: "svg handler" },
  {
    input: '<iframe src="javascript:alert(1)"></iframe>',
    forbidden: "iframe",
    note: "iframe",
  },
  {
    input: "<p><!--<script>alert(1)</script>--></p>",
    forbidden: "script",
    note: "script hidden in a comment",
  },
  {
    input: '<style>body{background:url("javascript:alert(1)")}</style>',
    forbidden: "javascript",
    note: "style block",
  },
  {
    input: '<a href="https://ok.example" onmouseover="alert(1)">ok</a>',
    forbidden: "onmouseover",
    note: "handler alongside a legitimate href",
  },
  {
    input: '<span class="mention" data-mention-id="../../etc">m</span>',
    forbidden: "../..",
    note: "mention id that is not a uuid",
  },
  {
    input: '<p class="x" style="background:url(javascript:alert(1))">y</p>',
    forbidden: "style",
    note: "style attribute",
  },
  {
    input: "<math><mtext><script>alert(1)</script></mtext></math>",
    forbidden: "script",
    note: "mathml wrapper",
  },
  {
    input: '<form action="/x"><button>go</button></form>',
    forbidden: "<form",
    note: "form injection",
  },
  /**
   * Mutation XSS. These are the payloads a regex-based pass loses to: each is
   * inert as written, and the browser's own parser rearranges it into markup
   * that is not. Only a sanitiser that parses the way the browser parses can
   * see the second shape, which is the reason this file's engine is DOMPurify
   * rather than the hand-rolled rebuild it replaced.
   */
  {
    input:
      '<noscript><p title="</noscript><img src=x onerror=alert(1)>"></noscript>',
    forbidden: "onerror",
    note: "mXSS through noscript title",
  },
  {
    input:
      '<svg></p><style><a id="</style><img src=1 onerror=alert(1)>"></style></svg>',
    forbidden: "onerror",
    note: "mXSS through svg style",
  },
  {
    input:
      '<math><mtext><table><mglyph><style><!--</style><img src onerror=alert(1)>',
    forbidden: "onerror",
    note: "mXSS through mathml mglyph",
  },
  {
    input: '<a href="  JaVaScRiPt&#58;alert(1)">x</a>',
    forbidden: "alert",
    note: "entity-encoded colon with leading whitespace",
  },
  {
    input: '<object data="javascript:alert(1)"></object>',
    forbidden: "object",
    note: "object tag",
  },
];

/** Markup the editor legitimately produces, which must survive intact. */
const PRESERVED: [string, string][] = [
  ["<p>Hello <strong>world</strong></p>", "strong"],
  ['<a href="https://example.com">link</a>', "https://example.com"],
  [
    '<span class="mention" data-mention-id="94000000-0000-4000-8000-000000000002">@P8</span>',
    "data-mention-id",
  ],
  ["<ul><li>one</li><li>two</li></ul>", "<li>"],
  ["<pre><code>const x = 1;</code></pre>", "<code>"],
];

const SAFE_URLS = [
  "https://a.example",
  "http://a.example",
  "mailto:a@b.c",
  "/rel",
  "#frag",
];
const UNSAFE_URLS = [
  "javascript:alert(1)",
  "data:text/html,x",
  "JAVASCRIPT:alert(1)",
  "java\tscript:alert(1)",
  "vbscript:msgbox(1)",
];

let failures = 0;

function report(pass: boolean, label: string, detail = ""): void {
  if (!pass) failures += 1;
  console.warn(
    `${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

for (const vector of VECTORS) {
  const output = sanitizeRichText(vector.input);
  const leaked = output.toLowerCase().includes(vector.forbidden.toLowerCase());
  report(!leaked, `neutralises ${vector.note}`, leaked ? output : "");
}

for (const [input, expected] of PRESERVED) {
  const output = sanitizeRichText(input);
  report(output.includes(expected), `preserves ${expected}`, output);
}

for (const url of SAFE_URLS) {
  report(isSafeUrl(url), `allows ${url}`);
}

for (const url of UNSAFE_URLS) {
  report(!isSafeUrl(url), `blocks ${JSON.stringify(url)}`);
}

const total =
  VECTORS.length + PRESERVED.length + SAFE_URLS.length + UNSAFE_URLS.length;
console.warn(
  failures === 0
    ? `SANITISER SUITE: pass (${total} assertions)`
    : `SANITISER SUITE: ${failures} FAILURE(S) of ${total}`,
);

if (failures > 0) process.exitCode = 1;
