"use client";

import Image from "next/image";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { clientEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/client";

type Provider = "google" | "github";

interface OAuthButtonsProps {
  /** Carried through the OAuth round trip so the callback can honour it. */
  inviteToken?: string;
}

/**
 * Google's mark is a third-party brand asset served from public/, not an inline
 * SVG. Its colours are fixed by Google and must not move when this app is
 * re-themed, which is exactly what a raw hex inside a component would invite.
 */
function GoogleMark() {
  return (
    <Image
      src="/brand/google-mark.svg"
      alt=""
      width={16}
      height={16}
      className="size-4 shrink-0"
    />
  );
}

function GitHubMark() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="size-4 shrink-0 fill-current"
      aria-hidden
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38l-.01-1.34c-2.23.48-2.7-1.07-2.7-1.07-.36-.93-.89-1.18-.89-1.18-.73-.5.06-.49.06-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.03 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48l-.01 2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
    </svg>
  );
}

export function OAuthButtons({ inviteToken }: OAuthButtonsProps) {
  const [pending, setPending] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signIn(provider: Provider) {
    setPending(provider);
    setError(null);

    const callback = new URL("/auth/callback", clientEnv.NEXT_PUBLIC_APP_URL);
    if (inviteToken) {
      callback.searchParams.set("invite", inviteToken);
    }

    const supabase = createClient();
    const queryParams: Record<string, string> = {};
    if (provider === "google") {
      queryParams.prompt = "select_account";
    }

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: callback.toString(),
        queryParams,
      },
    });

    if (oauthError) {
      setPending(null);
      setError("Could not reach the sign-in provider. Try again.");
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        variant="secondary"
        disabled={pending !== null}
        onClick={() => signIn("google")}
        className="w-full justify-center gap-2"
      >
        <GoogleMark />
        {pending === "google" ? "Redirecting…" : "Continue with Google"}
      </Button>

      <Button
        type="button"
        variant="secondary"
        disabled={pending !== null}
        onClick={() => signIn("github")}
        className="w-full justify-center gap-2"
      >
        <GitHubMark />
        {pending === "github" ? "Redirecting…" : "Continue with GitHub"}
      </Button>

      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
