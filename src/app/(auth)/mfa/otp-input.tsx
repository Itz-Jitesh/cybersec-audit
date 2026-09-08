"use client";

import { useRef } from "react";

import { cn } from "@/lib/utils";

interface OtpInputProps {
  value: string;
  onChange: (next: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  length?: number;
}

/**
 * Six separate boxes rather than one input, because that is what an
 * authenticator code looks like everywhere else and the shape tells the user
 * how much to type before they start.
 *
 * Paste is handled explicitly: people copy the whole code out of their
 * authenticator app, and a per-box input that only accepts single characters
 * would swallow all but the first digit.
 */
export function OtpInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  length = 6,
}: OtpInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function commit(next: string) {
    const digits = next.replace(/\D/g, "").slice(0, length);
    onChange(digits);
    if (digits.length === length) {
      onComplete?.(digits);
    }
    return digits;
  }

  function focusBox(index: number) {
    refs.current[Math.min(Math.max(index, 0), length - 1)]?.focus();
  }

  return (
    <div className="flex gap-2" role="group" aria-label="Six-digit code">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          value={value[index] ?? ""}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, "");
            if (!typed) return;

            // A multi-character value here means a paste landed in this box.
            const next =
              typed.length > 1
                ? commit(value.slice(0, index) + typed)
                : commit(
                    value.slice(0, index) + typed[0] + value.slice(index + 1),
                  );

            focusBox(Math.min(next.length, index + typed.length));
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace") {
              event.preventDefault();
              if (value[index]) {
                commit(value.slice(0, index) + value.slice(index + 1));
                focusBox(index);
              } else {
                commit(value.slice(0, index - 1) + value.slice(index));
                focusBox(index - 1);
              }
            }
            if (event.key === "ArrowLeft") focusBox(index - 1);
            if (event.key === "ArrowRight") focusBox(index + 1);
          }}
          className={cn(
            "h-11 w-full rounded-md border border-border-strong bg-bg-90 text-center text-lg font-medium text-text-100",
            "outline-none focus:border-border-focus",
            "disabled:opacity-60",
          )}
        />
      ))}
    </div>
  );
}
