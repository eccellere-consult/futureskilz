"use client";

import { ArrowRight, KeyRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { verifySignInLink } from "./store";

export function VerifySignIn() {
  const [token, setToken] = useState<string | null | undefined>(undefined);
  const [status, setStatus] = useState<"ready" | "working" | "failed">("ready");
  const [error, setError] = useState<string | null>(null);

  const capturedToken = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    // The token arrives in the fragment (never sent to a server). Take it out of the address bar at once,
    // so it never lingers in history or screenshots. The ref keeps it if React runs this effect twice.
    if (capturedToken.current === undefined) {
      capturedToken.current = new URLSearchParams(window.location.hash.slice(1)).get("token");
      window.history.replaceState(null, "", "/auth/verify");
    }
    const timer = window.setTimeout(() => setToken(capturedToken.current ?? null), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function handleContinue() {
    if (!token || status === "working") return;
    setStatus("working");
    try {
      const redirectPath = await verifySignInLink(token);
      // A full navigation makes every component read the new session.
      window.location.assign(redirectPath);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "This link has expired or was already used.");
      setStatus("failed");
    }
  }

  if (token === undefined) return <div aria-label="Checking your link" className="min-h-[60vh]" />;

  const invalid = !token || status === "failed";

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-20 sm:px-8 sm:py-28">
      <section className="border-t-2 border-gold bg-surface p-6 shadow-[0_18px_48px_rgba(14,14,13,0.08)] sm:p-10">
        <KeyRound aria-hidden="true" className="text-gold" size={26} />
        <h1 className="mt-5 font-serif text-4xl leading-tight sm:text-5xl">
          {invalid ? "This link can’t be used." : "One tap to continue."}
        </h1>
        <p className="mt-4 text-sm leading-6 text-ink-mid" role={invalid ? "alert" : undefined}>
          {invalid
            ? error ?? "The link is incomplete. Request a new one and we’ll send it straight away."
            : "We confirm it’s you, save your progress to your account and take you to your next step."}
        </p>
        {invalid ? (
          <Link className="primary-button mt-8" href="/sign-in">Request a new link <ArrowRight aria-hidden="true" size={17} /></Link>
        ) : (
          <button className="primary-button mt-8" disabled={status === "working"} onClick={() => void handleContinue()} type="button">
            {status === "working" ? "Signing you in…" : "Continue to FutureSkilz"} <ArrowRight aria-hidden="true" size={17} />
          </button>
        )}
      </section>
    </div>
  );
}
