"use client";

import Link from "next/link";
import { useState } from "react";

import { formatMoney, messageOf, post, shortDate, useRemote } from "./api";

type Statement = { id: string; status: string; totalMinor: number; currency: string; periodStart: string; periodEnd: string; disputeNote: string | null; coach: string; policyVersion: string; policyApproved: boolean };
type Receipt = { id: string; externalRef: string; grossMinor: number; refundMinor: number; feeMinor: number; taxMinor: number; currency: string; status: string; receivedAt: string };

const STATUS: Record<string, string> = { illustrative: "Preview only", draft: "Draft", final: "Final, to pay", disputed: "Disputed", paid: "Paid", void: "Void" };

const CONNECTIONS: Array<[string, string, string]> = [
  ["Razorpay (UPI, cards, EMI, GST invoices)", "Not connected", "Learner payments are not taken yet. Receipts are entered by hand under Earnings and policy until this is connected."],
  ["Payout provider for coaches", "Not connected", "Statements are marked paid here after you have paid the coach outside the system."],
];

export function AdminPayments() {
  const statements = useRemote<{ statements: Statement[] }>("/api/contribute/admin/statements");
  const receipts = useRemote<{ receipts: Receipt[] }>("/api/contribute/admin/receipts");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "final" | "paid" | "void") {
    setBusy(id);
    setError(null);
    try {
      await post(`/api/contribute/admin/statements/${id}`, { action });
      statements.reload();
    } catch (caught) {
      setError(messageOf(caught));
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <p className="font-mono text-[10px] uppercase text-gold">Admin</p>
      <h1 className="mt-1 font-display text-4xl font-semibold sm:text-5xl">Payments</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-mid">What coaches are owed, what has been paid, and the money coming in. A statement can only become payable once its revenue-share policy is approved under <Link className="text-teal underline underline-offset-4" href="/contribute/admin">Earnings and policy</Link>.</p>

      <section aria-label="Connections" className="mt-6 grid gap-px border border-border bg-border md:grid-cols-2">
        {CONNECTIONS.map(([name, state, note]) => (
          <div key={name} className="bg-surface p-5"><p className="font-semibold">{name}</p><p className="mt-1 inline-block bg-gold-pale px-2 py-0.5 font-mono text-[10px] uppercase">{state}</p><p className="mt-2 text-xs leading-5 text-ink-mid">{note}</p></div>
        ))}
      </section>

      {error ? <p className="mt-4 text-sm text-crimson" role="alert">{error}</p> : null}

      <section aria-label="Statements" className="mt-10">
        <h2 className="font-display text-2xl">Coach statements</h2>
        {!statements.data ? <p className="mt-2 text-sm text-ink-light">{statements.error ?? "Loading…"}</p> : statements.data.statements.length === 0 ? <p className="mt-2 text-sm text-ink-light">No statements yet. Run an allocation under Earnings and policy.</p> : (
          <div className="mt-3 overflow-x-auto border border-border bg-surface">
            <table className="w-full min-w-170 text-left text-sm">
              <thead className="border-b border-border font-mono text-[10px] uppercase text-ink-light"><tr><th className="p-3">Coach</th><th className="p-3">Period</th><th className="p-3">Policy</th><th className="p-3">Status</th><th className="p-3 text-right">Amount</th><th className="p-3">Action</th></tr></thead>
              <tbody>
                {statements.data.statements.map((row) => (
                  <tr key={row.id} className="border-b border-border/60 align-top">
                    <td className="p-3 font-semibold">{row.coach}</td>
                    <td className="p-3 text-xs">{shortDate(row.periodStart)} to {shortDate(row.periodEnd)}</td>
                    <td className="p-3 text-xs">{row.policyVersion}{row.policyApproved ? "" : " (not approved)"}</td>
                    <td className="p-3">{STATUS[row.status] ?? row.status}{row.disputeNote ? <span className="mt-1 block text-xs text-crimson">“{row.disputeNote}”</span> : null}</td>
                    <td className="p-3 text-right">{formatMoney(row.totalMinor, row.currency)}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        {row.status === "draft" ? <button className="border border-ink px-2 py-1" disabled={busy === row.id} onClick={() => void act(row.id, "final")} type="button">Finalise</button> : null}
                        {row.status === "final" ? <button className="border border-teal px-2 py-1 text-teal" disabled={busy === row.id} onClick={() => void act(row.id, "paid")} type="button">Mark paid</button> : null}
                        {row.status !== "paid" && row.status !== "void" ? <button className="border border-border px-2 py-1 text-ink-mid" disabled={busy === row.id} onClick={() => void act(row.id, "void")} type="button">Void</button> : null}
                        {row.status === "illustrative" ? <span className="text-ink-light">Approve the policy and run it again to make this payable.</span> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-label="Receipts" className="mt-10">
        <h2 className="font-display text-2xl">Learner receipts</h2>
        {!receipts.data ? <p className="mt-2 text-sm text-ink-light">{receipts.error ?? "Loading…"}</p> : receipts.data.receipts.length === 0 ? <p className="mt-2 text-sm text-ink-light">None recorded yet.</p> : (
          <div className="mt-3 overflow-x-auto border border-border bg-surface">
            <table className="w-full min-w-150 text-left text-sm">
              <thead className="border-b border-border font-mono text-[10px] uppercase text-ink-light"><tr><th className="p-3">Reference</th><th className="p-3">Received</th><th className="p-3">Status</th><th className="p-3 text-right">Gross</th><th className="p-3 text-right">Refund, fee, tax</th></tr></thead>
              <tbody>{receipts.data.receipts.map((row) => <tr key={row.id} className="border-b border-border/60"><td className="p-3">{row.externalRef}</td><td className="p-3 text-xs">{shortDate(row.receivedAt)}</td><td className="p-3 text-xs">{row.status}</td><td className="p-3 text-right">{formatMoney(row.grossMinor, row.currency)}</td><td className="p-3 text-right text-xs">{formatMoney(row.refundMinor, row.currency)} · {formatMoney(row.feeMinor, row.currency)} · {formatMoney(row.taxMinor, row.currency)}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
