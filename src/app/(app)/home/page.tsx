import { requireUser } from "@/lib/auth/session";

/**
 * Placeholder until phase 6 builds the shell and the real dashboard. It exists
 * now so the authentication flow has a destination that proves a session,
 * a membership and any required second factor are all in place.
 */
export default async function HomePage() {
  const user = await requireUser();

  return (
    <main className="px-6 pt-4">
      <h1 className="text-2xl font-semibold text-text-100">
        Welcome, {user.displayName}
      </h1>
      <p className="mt-1 text-sm text-text-300">
        Signed in as {user.email} · {user.role.replace("_", " ")}
      </p>
    </main>
  );
}
