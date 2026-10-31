"use client";

import Link from "next/link";
import { useState } from "react";

import { STATES } from "@/features/payments/gst";
import { ApiError, formatMoney, messageOf, post, shortDate, useRemote } from "@/features/capture/ui/api";
import type { BillingView, Checkout } from "@/server/payments/service";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open(): void; on(event: string, handler: (response: unknown) => void): void };
  }
}

function loadRazorpay(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("The payment window could not be loaded. Check your connection and try again."));
    document.head.appendChild(script);
  });
}

export function PricingView() {
  const { data, error, reload } = useRemote<BillingView>("/api/payments/billing");
  const [planId, setPlanId] = useState<string>("");
  const [state, setState] = useState("");
  const [gstin, setGstin] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Checkout | null>(null);

  if (!data) {
    const signedOut = error && /sign in/i.test(error);
    return <div className="mx-auto max-w-3xl px-5 py-16" role="status">{signedOut ? <p>Please <Link className="text-teal underline underline-offset-4" href="/sign-in">sign in</Link> to see your plan and billing.</p> : <p className="text-ink-light">{error ?? "Loading…"}</p>}</div>;
  }
  const chosen = data.plans.find((plan) => plan.id === (planId || data.plans[0]?.id));

  const confirm = async (order: Checkout, paymentId: string, signature: string) => {
    await post("/api/payments/confirm", { providerOrderId: order.providerOrderId, paymentId, signature });
    setPending(null);
    setNotice("Thank you. Your pass is active and your invoice is below.");
    reload();
  };

  const pay = async () => {
    if (!chosen) return;
    setBusy(true);
    setProblem(null);
    setNotice(null);
    try {
      const order = await post<Checkout>("/api/payments/checkout", { planId: chosen.id, state, gstin, code });
      if (order.provider === "test") { setPending(order); return; }
      await loadRazorpay();
      const razorpay = new window.Razorpay!({
        key: order.keyId,
        amount: order.amountMinor,
        currency: order.currency,
        order_id: order.providerOrderId,
        name: "FutureSkilz",
        description: order.planName,
        prefill: order.prefill,
        theme: { color: "#14213d" },
        handler: (response: { razorpay_payment_id: string; razorpay_signature: string }) => {
          void confirm(order, response.razorpay_payment_id, response.razorpay_signature).catch((caught) => setProblem(messageOf(caught)));
        },
      });
      razorpay.on("payment.failed", () => setProblem("The payment did not go through. You have not been charged for a pass; try again or use another method."));
      razorpay.open();
    } catch (caught) {
      setProblem(caught instanceof ApiError ? caught.message : messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  const simulate = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await post("/api/payments/test-pay", { providerOrderId: pending.providerOrderId });
      setPending(null);
      setNotice("Test payment recorded. No money moved. Your pass and invoice are below.");
      reload();
    } catch (caught) {
      setProblem(messageOf(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-8">
      <p className="font-mono text-[10px] uppercase text-teal">Plans and billing</p>
      <h1 className="mt-2 font-display text-4xl">Start free. Pay when you want everything.</h1>
      <p className="mt-3 max-w-2xl text-ink-mid">The first {data.freePerPillar} Skill Shots in every area are free, always. A pass opens all of them for a set time. Prices include GST, and you get a GST invoice for every payment.</p>
      {problem ? <p role="alert" className="mt-4 border-l-2 border-crimson bg-crimson/5 px-4 py-2 text-sm text-crimson">{problem}</p> : null}
      {notice ? <p role="status" className="mt-4 border-l-2 border-teal bg-teal/5 px-4 py-2 text-sm">{notice}</p> : null}

      {data.pass ? <p className="mt-6 border border-teal bg-teal/5 p-4 text-sm"><strong>{data.pass.planName}</strong> is active until {shortDate(data.pass.endsAt)}. If you buy again, the new pass starts when this one ends.</p> : null}

      {!data.live ? (
        <p className="mt-6 border border-border bg-surface p-4 text-sm text-ink-mid">Paid plans are not on sale yet, so every Skill Shot is open to you for now.</p>
      ) : (
        <section aria-label="Plans" className="mt-6">
          <div className="grid gap-3 sm:grid-cols-2">
            {data.plans.map((plan) => (
              <label key={plan.id} className={`block cursor-pointer border p-4 ${chosen?.id === plan.id ? "border-ink bg-surface" : "border-border"}`}>
                <input className="sr-only" type="radio" name="plan" checked={chosen?.id === plan.id} onChange={() => setPlanId(plan.id)} />
                <span className="font-display text-xl">{plan.name}</span>
                <span className="mt-1 block font-serif text-3xl">{formatMoney(plan.amountMinor, plan.currency)}</span>
                <span className="block text-xs text-ink-light">for {plan.durationDays} days, GST included</span>
                {plan.description ? <span className="mt-2 block text-sm text-ink-mid">{plan.description}</span> : null}
              </label>
            ))}
          </div>
          <div className="mt-4 grid gap-3 border border-border bg-surface p-4 sm:grid-cols-3">
            <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Your state (for GST)</span>
              <select className="field-input py-1.5! text-sm" value={state} onChange={(event) => setState(event.target.value)}><option value="">Choose…</option>{STATES.map((s) => <option key={s.code} value={s.code}>{s.name}</option>)}</select></label>
            <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">GSTIN (optional, for a business)</span><input className="field-input py-1.5! text-sm" maxLength={15} value={gstin} onChange={(event) => setGstin(event.target.value.toUpperCase())} /></label>
            <label className="block text-xs"><span className="font-mono text-[10px] uppercase text-ink-light">Discount code (optional)</span><input className="field-input py-1.5! text-sm" maxLength={40} value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} /></label>
          </div>
          <button type="button" className="primary-button mt-4" disabled={busy || !chosen || !state} onClick={() => void pay()}>{busy ? "One moment…" : chosen ? `Pay ${formatMoney(chosen.amountMinor, chosen.currency)}` : "Pay"}</button>
          <p className="mt-2 text-xs text-ink-light">You pay on Razorpay&apos;s secure window with UPI, card, netbanking or EMI where your bank offers it. We never see your card or UPI details.</p>
          {pending ? (
            <div className="mt-4 border border-gold bg-gold-pale p-4 text-sm">
              <p><strong>Test mode.</strong> No real payment is taken. {pending.planName}: {formatMoney(pending.amountMinor, pending.currency)}{pending.discountMinor ? ` (after ${formatMoney(pending.discountMinor, pending.currency)} off)` : ""}.</p>
              <button type="button" className="primary-button mt-2" disabled={busy} onClick={() => void simulate()}>Simulate a successful payment</button>
            </div>
          ) : null}
        </section>
      )}

      <section aria-label="Invoices" className="mt-10">
        <h2 className="font-display text-2xl">Your invoices</h2>
        {data.invoices.length === 0 ? <p className="mt-2 text-sm text-ink-light">None yet.</p> : (
          <ul className="mt-3 divide-y divide-border border border-border bg-surface text-sm">
            {data.invoices.map((invoice) => (
              <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-2 p-3"><span>{invoice.number} · {shortDate(invoice.issuedAt)} · {invoice.description}</span><span className="flex items-center gap-4">{formatMoney(invoice.totalMinor, invoice.currency)}<a className="text-teal underline underline-offset-4" href={`/api/payments/invoices/${invoice.id}`}>PDF</a></span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
