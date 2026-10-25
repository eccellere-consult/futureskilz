"use client";

import { useState } from "react";

import { PasswordSignInForm } from "./password-sign-in-form";
import { SignInForm } from "./sign-in-form";

type Props = { next?: string; includeGuestProgress: boolean; linkLabel: string };

/** Two ways in: an emailed one-tap link (anyone, new or returning) or an email and password (accounts that have one). */
export function SignInOptions({ next, includeGuestProgress, linkLabel }: Props) {
  const [mode, setMode] = useState<"link" | "password">("link");
  const tab = (id: "link" | "password", label: string) => (
    <button aria-selected={mode === id} className={`flex-1 border-b-2 px-2 py-2 text-sm font-semibold ${mode === id ? "border-gold text-ink" : "border-transparent text-ink-light"}`} onClick={() => setMode(id)} role="tab" type="button">{label}</button>
  );
  return (
    <div>
      <div className="mb-5 flex" role="tablist" aria-label="How to sign in">
        {tab("link", "Email me a link")}
        {tab("password", "Email and password")}
      </div>
      {mode === "link" ? <SignInForm includeGuestProgress={includeGuestProgress} next={next} submitLabel={linkLabel} /> : <PasswordSignInForm next={next} />}
    </div>
  );
}
