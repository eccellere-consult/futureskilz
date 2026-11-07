"use client";

import { Copy, Download, Printer } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { messageOf, post, useRemote, api } from "../capture/ui/api";
import { PassportDocument } from "./PassportDocument";
import { DEFAULT_SHARE, type Passport, type ShareOptions } from "./model";

type Share = { id: string; label: string; include: ShareOptions; expiresAt: string; revokedAt: string | null; views: number; lastViewedAt: string | null; active: boolean };

/** The owner's view: the passport itself, files to take away, and links to share it, each of which can be revoked. */
export function PassportManager() {
  const passport = useRemote<{ passport: Passport }>("/api/passport");
  const shares = useRemote<{ shares: Share[] }>("/api/passport/shares");
  const [options, setOptions] = useState<ShareOptions>(DEFAULT_SHARE);
  const [days, setDays] = useState(30);
  const [label, setLabel] = useState("");
  const [fresh, setFresh] = useState<{ url: string; expiresAt: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (passport.error && /sign in/i.test(passport.error)) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24 text-center sm:px-8">
        <h1 className="font-serif text-4xl">Your Skill Passport lives with your account.</h1>
        <p className="mt-3 text-ink-mid">Sign in, and your levels, the lessons you completed and the situations you described are gathered here, ready to share.</p>
        <Link className="primary-button mt-8" href="/sign-in?next=/passport">Sign in</Link>
      </div>
    );
  }
  if (!passport.data) return <div aria-label="Loading" className="min-h-96" role="status">{passport.error ? <p className="p-8 text-crimson">{passport.error}</p> : null}</div>;

  const create = async () => {
    setError(null);
    try {
      const made = await post<{ token: string; expiresAt: string }>("/api/passport/shares", { label, days, include: options });
      setFresh({ url: `${window.location.origin}/p/${made.token}`, expiresAt: made.expiresAt });
      setLabel("");
      shares.reload();
    } catch (caught) {
      setError(messageOf(caught));
    }
  };
  const revoke = async (id: string) => {
    setError(null);
    try {
      await api(`/api/passport/shares?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setNotice("Link revoked. It no longer works.");
      shares.reload();
    } catch (caught) {
      setError(messageOf(caught));
    }
  };
  const toggle = (key: keyof ShareOptions) => setOptions((value) => ({ ...value, [key]: !value[key] }));

  return (
    <div className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-8">
      <div className="print:hidden">
        <h1 className="font-serif text-4xl sm:text-5xl">Your Skill Passport</h1>
        <p className="mt-2 max-w-3xl text-ink-mid">What you can show, and how firmly. It grows as you complete lessons and describe real situations.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button className="primary-button" onClick={() => window.print()} type="button"><Printer size={16} />Print or save as PDF</button>
          <a className="inline-flex min-h-11 items-center gap-2 border border-border px-4 text-sm font-semibold hover:border-gold" href="/api/passport/export?format=csv"><Download size={16} />Spreadsheet (CSV)</a>
          <a className="inline-flex min-h-11 items-center gap-2 border border-border px-4 text-sm font-semibold hover:border-gold" href="/api/passport/export?format=json"><Download size={16} />Everything (JSON)</a>
        </div>
      </div>

      <div className="mt-8"><PassportDocument passport={passport.data.passport} /></div>

      <section aria-label="Share" className="mt-10 border border-border bg-surface p-5 sm:p-6 print:hidden">
        <h2 className="font-display text-2xl">Share it with a link</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-mid">Anyone with the link can read the passport until it expires or you revoke it. They cannot see your goals, practice notes or anything you wrote to Arya. The link shows your current levels, so it stays up to date.</p>
        <fieldset className="mt-4 space-y-2 text-sm">
          <legend className="font-semibold">Show on the link</legend>
          <label className="flex items-center gap-2"><input checked={options.name} onChange={() => toggle("name")} type="checkbox" />My name and current role</label>
          <label className="flex items-center gap-2"><input checked={options.targetRole} onChange={() => toggle("targetRole")} type="checkbox" />My target role</label>
          <label className="flex items-center gap-2"><input checked={options.evidence} onChange={() => toggle("evidence")} type="checkbox" />What I have completed</label>
        </fieldset>
        <div className="mt-4 flex flex-wrap items-end gap-3 text-sm">
          <label>Works for <select className="ml-1 min-h-10 border border-border bg-white px-2" onChange={(event) => setDays(Number(event.target.value))} value={days}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label>
          <label>Note to self <input className="ml-1 min-h-10 border border-border bg-white px-2" maxLength={120} onChange={(event) => setLabel(event.target.value)} placeholder="For the Acme application" value={label} /></label>
          <button className="primary-button" onClick={() => void create()} type="button">Create link</button>
        </div>
        {error ? <p className="mt-3 text-sm text-crimson" role="alert">{error}</p> : null}
        {notice ? <p className="mt-3 text-sm text-teal" role="status">{notice}</p> : null}
        {fresh ? (
          <div className="mt-4 border-l-2 border-gold bg-gold-pale/50 p-3 text-sm" role="status">
            <p className="font-semibold">Your link. Copy it now: it is shown only once.</p>
            <p className="mt-1 break-all font-mono text-xs">{fresh.url}</p>
            <button className="mt-2 inline-flex items-center gap-2 underline underline-offset-4" onClick={() => void navigator.clipboard?.writeText(fresh.url)} type="button"><Copy size={14} />Copy</button>
          </div>
        ) : null}

        <h3 className="mt-6 font-semibold">Your links</h3>
        {!shares.data ? <p className="mt-2 text-sm text-ink-light">Loading…</p> : shares.data.shares.length === 0 ? <p className="mt-2 text-sm text-ink-mid">None yet.</p> : (
          <ul className="mt-2 divide-y divide-border border border-border text-sm">
            {shares.data.shares.map((share) => (
              <li className="flex flex-wrap items-center justify-between gap-3 p-3" key={share.id}>
                <span>{share.label || "Untitled link"} <span className="text-ink-light">· {share.active ? `works until ${new Date(share.expiresAt).toLocaleDateString("en-IN")}` : share.revokedAt ? "revoked" : "expired"} · opened {share.views} time{share.views === 1 ? "" : "s"}</span></span>
                {share.active ? <button className="underline underline-offset-4" onClick={() => void revoke(share.id)} type="button">Revoke</button> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
