"use client";

import { ArrowRight } from "lucide-react";
import { useId, useState, type FormEvent } from "react";

/** Email and password, for accounts an admin gave a password (staff and test users). Everyone else uses the emailed link. */
export function PasswordSignInForm({ next }: { next?: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, next }) });
      const data = (await response.json().catch(() => ({}))) as { error?: string; redirectPath?: string };
      if (!response.ok) throw new Error(data.error ?? "Sign-in failed. Please try again.");
      // A full navigation makes every component read the new session.
      window.location.assign(data.redirectPath ?? "/learn");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Sign-in failed. Please try again.");
      setBusy(false);
    }
  }

  return (
    <form noValidate onSubmit={(event) => void submit(event)}>
      <label className="block font-mono text-[10px] uppercase text-ink-light" htmlFor={`${id}-email`}>Email address</label>
      <input autoComplete="username" className="field-input" id={`${id}-email`} inputMode="email" onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" type="email" value={email} />
      <label className="mt-3 block font-mono text-[10px] uppercase text-ink-light" htmlFor={`${id}-password`}>Password</label>
      <input autoComplete="current-password" className="field-input" id={`${id}-password`} onChange={(event) => setPassword(event.target.value)} type="password" value={password} />
      {error ? <p className="mt-2 text-xs text-crimson" role="alert">{error}</p> : null}
      <button className="primary-button mt-5 w-full sm:w-auto" disabled={!email.includes("@") || !password || busy} type="submit">
        {busy ? "Signing in…" : "Sign in"} <ArrowRight aria-hidden="true" size={17} />
      </button>
      <p className="mt-3 text-xs leading-5 text-ink-light">For accounts that have a password. No password yet? Use the emailed link instead.</p>
    </form>
  );
}
