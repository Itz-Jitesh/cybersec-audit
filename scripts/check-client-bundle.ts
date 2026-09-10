/**
 * Fails if a server-only secret reached the browser bundle.
 *
 *   pnpm build && pnpm check:bundle
 *
 * The rule this enforces is in CLAUDE.md: SUPABASE_SERVICE_ROLE_KEY is
 * server-only. It is checked here rather than by reading the code because the
 * failure mode is a build-time inline — a `process.env.X` reference that ends
 * up in a client component compiles to the literal value and looks perfectly
 * innocent in source.
 *
 * Both the variable names and, when they are set, their actual values are
 * searched: a leak that inlined the value would not contain the name.
 */

import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const CLIENT_DIRS = [".next/static"];

/** Names that must never appear in anything the browser downloads. */
const FORBIDDEN_NAMES = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "SMTP_PASSWORD",
  "SMTP_USER",
  "CRON_SECRET",
  "DATABASE_URL",
  "DATABASE_POOL_URL",
];

/** Live values, so an inlined secret is caught even without its name. */
const forbiddenValues = FORBIDDEN_NAMES.map((name) => process.env[name])
  .filter((value): value is string => Boolean(value && value.length >= 12));

async function* walk(dir: string): AsyncGenerator<string> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(path);
    } else if (/\.(js|mjs|css|map|json)$/.test(entry.name)) {
      yield path;
    }
  }
}

const findings: string[] = [];
let scanned = 0;

for (const dir of CLIENT_DIRS) {
  for await (const path of walk(dir)) {
    scanned += 1;
    const content = await readFile(path, "utf8");
    for (const name of FORBIDDEN_NAMES) {
      if (content.includes(name)) findings.push(`${path}: name ${name}`);
    }
    for (const value of forbiddenValues) {
      if (content.includes(value)) findings.push(`${path}: a secret's value`);
    }
  }
}

if (scanned === 0) {
  console.warn("No client bundle found. Run pnpm build first.");
  process.exitCode = 1;
} else if (findings.length > 0) {
  for (const finding of findings) console.warn(`LEAK  ${finding}`);
  console.warn(`BUNDLE SCAN: ${findings.length} leak(s) across ${scanned} files`);
  process.exitCode = 1;
} else {
  console.warn(`BUNDLE SCAN: clean (${scanned} client files)`);
}
