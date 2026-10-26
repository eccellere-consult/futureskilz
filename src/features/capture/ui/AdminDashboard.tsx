"use client";

import { AlertTriangle, CheckCircle2 } from "lucide-react";
import Link from "next/link";

import type { AdminOverview } from "@/server/capture/admin-overview-service";

import { formatMoney, shortDate, useRemote } from "./api";

const LINKS: Array<[string, string, string]> = [
  ["/contribute/admin/users", "Accounts", "Create people, give roles, reset passwords"],
  ["/contribute/admin", "Earnings and policy", "Revenue-share policy, receipts, allocation runs"],
  ["/admin/payments", "Payments", "Statements to finalise and pay, receipts, connections"],
  ["/contribute/editor", "Content approvals", "Lessons waiting for editors and coaches"],
  ["/demo", "Demo and sample data", "Build or retire the sample people and lessons"],
  ["/api/health", "System health", "Database, tables and mailbox"],
];

export function AdminDashboard() {
  const { data, error } = useRemote<AdminOverview>("/api/admin/overview");
  if (!data) return <div className="mx-auto max-w-3xl px-5 py-16 sm:px-8" role="status">{error ? <p className="text-crimson">{error}</p> : <p className="text-ink-light">Loading the dashboard…</p>}</div>;

  const inReview = (data.lessons.in_review ?? 0) + (data.lessons.awaiting_contributor ?? 0);
  const statement = (status: string) => data.statements.find((row) => row.status === status);
  const owed = statement("final");
  const money = data.receipts[0];
  const attention: Array<{ text: string; href: string }> = [];
  if (!(data.policies.approved ?? 0)) attention.push({ text: "No revenue-share policy is approved, so no statement can be payable.", href: "/contribute/admin" });
  if (inReview) attention.push({ text: `${inReview} lesson${inReview === 1 ? "" : "s"} waiting for an editor or a coach to approve.`, href: "/contribute/editor" });
  if (statement("disputed")?.count) attention.push({ text: `${statement("disputed")!.count} statement${statement("disputed")!.count === 1 ? "" : "s"} disputed by coaches.`, href: "/admin/payments" });
  if (owed?.count) attention.push({ text: `${owed.count} final statement${owed.count === 1 ? "" : "s"} to pay (${formatMoney(owed.totalMinor, "INR")}).`, href: "/admin/payments" });
  if (data.people.suspended) attention.push({ text: `${data.people.suspended} suspended account${data.people.suspended === 1 ? "" : "s"}.`, href: "/contribute/admin/users" });

  const tiles: Array<[string, Array<[string, number | string]>]> = [
    ["People", [["Accounts", data.people.total], ["Coaches", data.people.coaches], ["Editors", data.people.editors], ["Admins", data.people.admins]]],
    ["Content", [["Live lessons", data.lessons.published ?? 0], ["Waiting approval", inReview], ["Interviews in progress", data.projects.interviewing ?? 0], ["Ready for coach review", data.projects.in_review ?? 0]]],
    ["Money", [["Receipts recorded", money?.count ?? 0], ["Gross received", money ? formatMoney(money.grossMinor, money.currency) : "None yet"], ["Final, to pay", owed ? formatMoney(owed.totalMinor, "INR") : "None"], ["Paid", statement("paid") ? formatMoney(statement("paid")!.totalMinor, "INR") : "None"]]],
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <p className="font-mono text-[10px] uppercase text-gold">Admin</p>
      <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">Dashboard</h1>

      <section aria-label="What needs attention" className="mt-6 border border-border bg-surface p-5">
        <h2 className="font-display text-2xl">What needs attention</h2>
        {attention.length === 0 ? <p className="mt-2 flex items-center gap-2 text-sm text-teal"><CheckCircle2 aria-hidden="true" size={16} /> Nothing is waiting on you.</p> : (
          <ul className="mt-3 space-y-2 text-sm">
            {attention.map((item) => <li key={item.text} className="flex items-start gap-2"><AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-gold" size={16} /><Link className="text-teal underline underline-offset-4" href={item.href}>{item.text}</Link></li>)}
          </ul>
        )}
      </section>

      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {tiles.map(([title, rows]) => (
          <section key={title} aria-label={title} className="border border-border bg-surface p-5">
            <h2 className="font-display text-2xl">{title}</h2>
            <dl className="mt-3 space-y-2 text-sm">{rows.map(([label, value]) => <div key={label} className="flex items-baseline justify-between gap-3 border-b border-border/60 pb-1"><dt className="text-ink-mid">{label}</dt><dd className="font-display text-xl">{value}</dd></div>)}</dl>
          </section>
        ))}
      </div>

      <section aria-label="Admin areas" className="mt-8">
        <h2 className="font-display text-2xl">Go to</h2>
        <ul className="mt-3 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {LINKS.map(([href, label, hint]) => <li key={href} className="bg-surface"><Link className="block p-4 hover:bg-gold-pale" href={href}><span className="font-semibold">{label}</span><span className="mt-1 block text-xs leading-5 text-ink-mid">{hint}</span></Link></li>)}
        </ul>
      </section>

      <section aria-label="Recent activity" className="mt-8">
        <h2 className="font-display text-2xl">Recent activity</h2>
        {data.recent.length === 0 ? <p className="mt-2 text-sm text-ink-light">Nothing recorded yet.</p> : <ul className="mt-3 divide-y divide-border border border-border bg-surface text-sm">{data.recent.map((row) => <li key={row.id} className="flex justify-between gap-3 p-3"><span>{row.action} <span className="text-ink-light">· {row.entity}</span></span><span className="text-xs text-ink-light">{shortDate(row.at)}</span></li>)}</ul>}
      </section>
    </div>
  );
}
