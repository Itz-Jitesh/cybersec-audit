import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "@/db/schema";
import { serverEnv } from "@/lib/env";

/**
 * Drizzle client for Server Components and Server Actions.
 *
 * At runtime this must point at Supabase's transaction pooler (port 6543);
 * serverless invocations multiplied by a direct connection exhaust Postgres
 * connections quickly. The session pooler (5432) is for migrations only.
 *
 * The connection is memoised on globalThis so hot reloads in development do not
 * open a new pool on every edit.
 */
const globalForDb = globalThis as unknown as {
  connection: ReturnType<typeof postgres> | undefined;
};

const connection =
  globalForDb.connection ??
  postgres(serverEnv().DATABASE_URL, { prepare: false, max: 1 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.connection = connection;
}

export const db = drizzle(connection, { schema, casing: "snake_case" });
