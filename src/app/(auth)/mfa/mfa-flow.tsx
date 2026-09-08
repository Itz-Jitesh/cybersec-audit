"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { OtpInput } from "@/app/(auth)/mfa/otp-input";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

type Mode = "loading" | "enrol" | "challenge";

interface Enrolment {
  factorId: string;
  qrCode: string;
  secret: string;
}

/**
 * Handles both halves of the second factor: enrolment for someone who has never
 * set one up, and the challenge for someone who has. Which one applies is not
 * the user's choice, so it is derived from their existing factors rather than
 * offered as a tab.
 */
export function MfaFlow() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("loading");
  const [enrolment, setEnrolment] = useState<Enrolment | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function prepare() {
      const supabase = createClient();
      const { data, error: listError } = await supabase.auth.mfa.listFactors();

      if (cancelled) return;

      if (listError) {
        setError("Could not load your security settings. Reload to try again.");
        setMode("enrol");
        return;
      }

      // data.totp lists only verified factors; data.all is where a half-finished
      // enrolment shows up.
      const totp = data.all.filter((factor) => factor.factor_type === "totp");
      const verified = totp.find((factor) => factor.status === "verified");

      if (verified) {
        setFactorId(verified.id);
        setMode("challenge");
        return;
      }

      // An unverified factor is left behind when someone abandons enrolment
      // partway. Clearing it stops dead factors piling up on the account.
      for (const pending of totp.filter((f) => f.status === "unverified")) {
        await supabase.auth.mfa.unenroll({ factorId: pending.id });
      }

      const { data: enrolled, error: enrolError } =
        await supabase.auth.mfa.enroll({ factorType: "totp" });

      if (cancelled) return;

      if (enrolError || !enrolled) {
        setError("Could not start enrolment. Reload to try again.");
        setMode("enrol");
        return;
      }

      setEnrolment({
        factorId: enrolled.id,
        qrCode: enrolled.totp.qr_code,
        secret: enrolled.totp.secret,
      });
      setFactorId(enrolled.id);
      setMode("enrol");
    }

    void prepare();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = useCallback(
    async (submitted: string) => {
      if (!factorId || busy) return;

      setBusy(true);
      setError(null);

      const supabase = createClient();
      const { data: challenge, error: challengeError } =
        await supabase.auth.mfa.challenge({ factorId });

      if (challengeError || !challenge) {
        setBusy(false);
        setError("Could not reach the server. Try again.");
        return;
      }

      const { error: verifyError } = await supabase.auth.mfa.verify({
        factorId,
        challengeId: challenge.id,
        code: submitted,
      });

      if (verifyError) {
        setBusy(false);
        setCode("");
        setError("That code was not accepted. Codes expire every 30 seconds.");
        return;
      }

      // refresh() re-runs middleware with the upgraded assurance level, which is
      // what lets the redirect through.
      router.replace("/home");
      router.refresh();
    },
    [busy, factorId, router],
  );

  if (mode === "loading") {
    return (
      <div className="flex items-center gap-2 text-sm text-text-300">
        <Loader2 size={16} strokeWidth={1.5} className="animate-spin" />
        Checking your security settings…
      </div>
    );
  }

  const isEnrolling = mode === "enrol";

  return (
    <div className="flex flex-col">
      <h1 className="text-2xl font-semibold text-text-100">
        {isEnrolling
          ? "Set up two-factor authentication"
          : "Two-factor authentication"}
      </h1>
      <p className="mt-1 text-sm text-text-300">
        {isEnrolling
          ? "Your role requires a second factor. Scan this with an authenticator app, then enter the code it shows."
          : "Enter the six-digit code from your authenticator app."}
      </p>

      {isEnrolling && enrolment && (
        <div className="mt-5 flex flex-col gap-3">
          <div className="self-start rounded-lg border border-border-subtle bg-bg-90 p-3">
            {/* The QR is an SVG data URI from Supabase, not a remotely hosted
                raster, so next/image adds nothing here and its src validation
                rejects the data URI's trailing newline outright. A plain img
                sidesteps the pipeline and renders it as-is; trimEnd is a
                belt-and-braces guard against that same trailing control char. */}
            {/* eslint-disable @next/next/no-img-element -- see comment above: next/image cannot render this data URI */}
            <img
              src={enrolment.qrCode.trimEnd()}
              alt="Two-factor setup QR code"
              width={160}
              height={160}
            />
          </div>

          <div>
            <p className="text-xs text-text-300">
              Cannot scan? Enter this key manually.
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="flex-1 rounded-md border border-border-subtle bg-bg-90 px-2 py-1.5 font-mono text-xs break-all text-text-200">
                {enrolment.secret}
              </code>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await navigator.clipboard.writeText(enrolment.secret);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                aria-label="Copy setup key"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </Button>
            </div>
          </div>
        </div>
      )}

      <div className="mt-5">
        <OtpInput
          value={code}
          onChange={setCode}
          onComplete={submit}
          disabled={busy}
        />
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}

      <Button
        type="button"
        disabled={busy || code.length < 6}
        onClick={() => submit(code)}
        className="mt-4 w-full justify-center"
      >
        {busy ? "Verifying…" : "Verify"}
      </Button>

      <p className="mt-4 text-xs text-text-400">
        Lost your device? A club admin can remove your second factor so you can
        enrol again. There are no printed recovery codes.
      </p>
    </div>
  );
}
