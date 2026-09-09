import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { serverEnv } from "@/lib/env.server";

/**
 * Drizzle client for Server Components and Server Actions.
 *
 * Two connection strings, for the reason docs/03-TRD.md §6 gives.
 *
 * DATABASE_POOL_URL is the transaction pooler (port 6543) and is what runtime
 * queries must use: it multiplexes many short serverless invocations onto few
 * Postgres connections. DATABASE_URL is the session pooler (port 5432), which
 * holds one backend per client and is capped at fifteen — fine for migrations
 * and the seed, and not enough for thirty people using the app.
 *
 * Falling back to DATABASE_URL keeps a machine with only one of them working,
 * but a deployment serving real traffic should set both. A warning is logged
 * once when the runtime connection is on the session pooler, since the symptom
 * otherwise is intermittent "max clients reached" errors under load rather than
 * anything that points at its own cause.
 *
 * The connection is memoised on globalThis so hot reloads in development do not
 * open a new pool on every edit.
 */
const globalForDb = globalThis as unknown as {
  connection: ReturnType<typeof postgres> | undefined;
};

const env = serverEnv();
const runtimeUrl = env.DATABASE_POOL_URL ?? env.DATABASE_URL;

if (!env.DATABASE_POOL_URL && process.env.NODE_ENV === "production") {
  console.warn(
    "[db] DATABASE_POOL_URL is not set, so runtime queries are using the session pooler. Set it to the Supabase transaction pooler URI (port 6543).",
  );
}

/**
 * max was 1, which serialised every query in the process onto one backend: a
 * page doing eight reads in Promise.all executed them one after another, and
 * the round trips added up to most of the page's latency. Ten is safe against
 * the transaction pooler, which multiplexes them, and is the number the
 * connection has to be for parallel reads to actually be parallel.
 */
const connection =
  globalForDb.connection ??
  postgres(runtimeUrl, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    connect_timeout: 10,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.connection = connection;
}

export const db = drizzle(connection, { schema, casing: "snake_case" });
