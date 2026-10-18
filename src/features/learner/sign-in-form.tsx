"use client";

import { ArrowRight, MailCheck } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

import { requestSignInLink } from "./store";

type SignInFormProps = {
  name?: string;
  next?: string;
  includeGuestProgress: boolean;
  submitLabel: string;
  tone?: "light" | "dark";
};

export function SignInForm({ name, next, includeGuestProgress, submitLabel, tone = "light" }: SignInFormProps) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const dark = tone === "dark";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "sending") return;
    setStatus("sending");
    setError(null);
    try {
      await requestSignInLink({ email, name, next, includeGuestProgress });
      setStatus("sent");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "We could not send the email. Please try again.");
      setStatus("idle");
    }
  }

  if (status === "sent") {
    return (
      <div className={`flex gap-3 border-l-2 border-teal py-1 pl-4 ${dark ? "text-cream" : "text-ink"}`} role="status">
        <MailCheck aria-hidden="true" className="mt-0.5 shrink-0 text-teal" size={20} />
        <div>
          <p className="text-sm font-semibold">Check your email</p>
          <p className={`mt-1 text-xs leading-5 ${dark ? "text-cream/65" : "text-ink-light"}`}>
            We sent a one-tap link to <span className="font-medium">{email}</span>. It works once and expires in 15 minutes.
          </p>
          <button
            className={`mt-2 text-xs underline underline-offset-4 ${dark ? "text-gold-light" : "text-teal"}`}
            onClick={() => setStatus("idle")}
            type="button"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={(event) => void handleSubmit(event)}>
      <label className={`block font-mono text-[10px] uppercase ${dark ? "text-gold-light" : "text-ink-light"}`} htmlFor={inputId}>
        Email address
      </label>
      <input
        aria-describedby={error ? `${inputId}-error` : undefined}
        aria-invalid={Boolean(error)}
        autoComplete="email"
        className={`field-input ${dark ? "text-cream placeholder:text-cream/40" : ""}`}
        id={inputId}
        inputMode="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        required
        type="email"
        value={email}
      />
      {error ? (
        <p className="mt-2 text-xs text-crimson" id={`${inputId}-error`} role="alert">{error}</p>
      ) : null}
      <button className="primary-button mt-5 w-full sm:w-auto" disabled={!email.includes("@") || status === "sending"} type="submit">
        {status === "sending" ? "Sending…" : submitLabel}
        <ArrowRight aria-hidden="true" size={17} />
      </button>
      <p className={`mt-3 text-xs leading-5 ${dark ? "text-cream/55" : "text-ink-light"}`}>No password. We email you a link that signs you in.</p>
    </form>
  );
}
