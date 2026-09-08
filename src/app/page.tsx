import { redirect } from "next/navigation";

/**
 * The root has no content of its own. Middleware has already decided whether
 * there is a session by the time this runs, so an unauthenticated visitor is
 * sent to /sign-in from there and everyone else lands on the dashboard.
 */
export default function RootPage() {
  redirect("/home");
}
