import Image from "next/image";
import Link from "next/link";

import { OAuthButtons } from "@/app/(auth)/sign-in/oauth-buttons";
import { WORKSPACE_NAME } from "@/lib/constants/defaults";

interface SignInPageProps {
  searchParams: Promise<{ error?: string; invite?: string }>;
}

/**
 * The rejection notice is deliberately explicit rather than a silent redirect.
 * Someone turned away here has usually just been told by a friend that they
 * have access, and a blank sign-in page tells them nothing about what to do.
 */
const REJECTIONS: Record<string, { title: string; body: string }> = {
  no_invite: {
    title: "This workspace is invite-only",
    body: "The account you signed in with has no open invitation. Ask a club admin to send one to that email address, then try again.",
  },
  deactivated: {
    title: "Your membership is inactive",
    body: "This account has been deactivated. A club admin can restore it.",
  },
  auth_failed: {
    title: "Sign-in did not complete",
    body: "Something went wrong on the way back from the provider. Try again.",
  },
};

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const { error, invite } = await searchParams;
  const rejection = error ? REJECTIONS[error] : undefined;

  return (
    <div className="flex flex-col">
      <Image
        src="/brand/logo-full.svg"
        alt={WORKSPACE_NAME}
        width={120}
        height={28}
        priority
        className="h-auto w-[120px] text-text-100"
      />

      <h1 className="mt-6 text-2xl font-semibold text-text-100">
        Sign in to {WORKSPACE_NAME}
      </h1>
      <p className="mt-1 text-sm text-text-300">
        This workspace is invite-only
      </p>

      <div className="mt-3">
        {rejection ? (
          <div className="flex flex-col gap-3">
            <div
              role="alert"
              className="rounded-md border border-danger/50 bg-danger/10 px-3 py-2.5"
            >
              <p className="text-sm font-medium text-text-100">
                {rejection.title}
              </p>
              <p className="mt-1 text-xs text-text-300">{rejection.body}</p>
            </div>
            <Link
              href="/sign-in"
              className="text-xs text-text-300 transition-colors duration-[120ms] ease-out hover:text-text-100"
            >
              Back
            </Link>
          </div>
        ) : (
          <OAuthButtons inviteToken={invite} />
        )}
      </div>

      <p className="mt-6 text-xs text-text-400">
        Need access? Contact a club admin.
      </p>
    </div>
  );
}
