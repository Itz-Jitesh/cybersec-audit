/**
 * Fails if any colour under src/components or src/app bypasses the token layer.
 *
 *   pnpm check:tokens
 *
 * This is the check that makes the phase 13 reskin a one-file change. The rule
 * from CLAUDE.md is that every colour resolves through a CSS variable; the
 * point of enforcing it mechanically is that a single `text-white` added in a
 * hurry is invisible in review and turns "edit globals.css" into "edit
 * globals.css and hunt through forty components".
 *
 * Two exemptions, both deliberate:
 *   - globals.css is where the literals are supposed to live.
 *   - An inline style carrying a colour that arrives from the database — a
 *     state colour, a label colour, a team colour — cannot be a token, because
 *     the value is a row, not a design decision.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const ROOTS = ["src/components", "src/app"];
const EXEMPT = ["src/app/globals.css"];

const PATTERNS: { label: string; re: RegExp }[] = [
  { label: "raw hex", re: /#[0-9a-fA-F]{3,8}\b/g },
  { label: "rgb()/hsl()", re: /\b(?:rgba?|hsla?)\(/g },
  {
    label: "Tailwind palette class",
    re: /\b(?:bg|text|border|ring|fill|stroke|from|to|via|divide|outline|shadow|accent|caret|decoration)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}\b/g,
  },
  {
    label: "literal white/black",
    re: /\b(?:bg|text|border|ring|fill|stroke|divide|outline)-(?:white|black)\b/g,
  },
];

/**
 * A colour that came out of the database. `style={{ backgroundColor: x }}`
 * where x is an expression is fine; a literal in the same place is not, and
 * the hex pattern above already catches that case.
 */
function isDatabaseColour(line: string): boolean {
  return /(?:backgroundColor|borderColor|color|fill|stroke):\s*[A-Za-z_$`]/.test(
    line,
  );
}

async function* walk(dir: string): AsyncGenerator<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(path);
    else if (/\.(tsx?|css)$/.test(entry.name)) yield path;
  }
}

const findings: string[] = [];
let scanned = 0;

for (const root of ROOTS) {
  for await (const path of walk(root)) {
    if (EXEMPT.includes(path)) continue;
    scanned += 1;

    const lines = (await readFile(path, "utf8")).split("\n");
    lines.forEach((line, index) => {
      // A line that only mentions a colour in prose is not a colour.
      const code = line.replace(/^\s*(?:\/\/|\*|\/\*).*$/, "");
      if (!code.trim() || isDatabaseColour(code)) return;

      for (const { label, re } of PATTERNS) {
        re.lastIndex = 0;
        const match = re.exec(code);
        if (match) {
          findings.push(`${path}:${index + 1}  ${label}: ${match[0]}`);
        }
      }
    });
  }
}

if (findings.length > 0) {
  for (const finding of findings) console.warn(`UNTOKENISED  ${finding}`);
  console.warn(
    `TOKEN SCAN: ${findings.length} colour(s) bypass the token layer across ${scanned} files`,
  );
  process.exitCode = 1;
} else {
  console.warn(`TOKEN SCAN: clean (${scanned} files)`);
}
