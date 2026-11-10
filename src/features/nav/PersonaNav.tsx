"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { fetchSessionUser, type SessionUser } from "@/features/learner/store";

import { PERSONA_MENUS, activeItem, personaOfPath, personasFor, primaryPersona, type Persona } from "./personas";

type Step = { text: string; action: string; href: string };

const KEY = "fs-persona";
const listeners = new Set<() => void>();
const read = (): string => {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => void listeners.delete(listener);
};
function choose(persona: Persona) {
  try {
    window.localStorage.setItem(KEY, persona);
  } catch {
    /* storage can be blocked: the menu then follows the page */
  }
  listeners.forEach((listener) => listener());
}

/**
 * The signed-in menu: only what the person's role needs. A person with more than one role gets a switch for the others.
 * The menu follows the page they are on, and remembers their last choice on this device.
 */
export function PersonaNav() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const pathname = usePathname();
  const stored = useSyncExternalStore(subscribe, read, () => "");
  const [step, setStep] = useState<Step | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchSessionUser().then((sessionUser) => {
      if (active) setUser(sessionUser);
    });
    return () => {
      active = false;
    };
  }, []);

  const personaForStep = user ? ((): string => { const list = personasFor(user.roles); const here = personaOfPath(pathname); return here && list.includes(here) ? here : list.includes(stored as Persona) ? stored : primaryPersona(user.roles); })() : "";
  useEffect(() => {
    if (!personaForStep) return;
    let active = true;
    fetch(`/api/next-step?persona=${personaForStep}`, { cache: "no-store" })
      .then((response) => (response.ok ? (response.json() as Promise<{ step: Step | null }>) : null))
      .catch(() => null)
      .then((body) => {
        if (active) setStep(body?.step ?? null);
      });
    return () => {
      active = false;
    };
  }, [personaForStep, pathname]);

  if (!user) return null;
  const available = personasFor(user.roles);
  const onPage = personaOfPath(pathname);
  const persona: Persona = onPage && available.includes(onPage) ? onPage : available.includes(stored as Persona) ? (stored as Persona) : primaryPersona(user.roles);
  const menu = PERSONA_MENUS[persona];
  const current = activeItem(menu, pathname);

  return (
    <nav aria-label={`${menu.label} menu`} className="border-t border-cream/10 bg-ink/95 text-cream">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-4 overflow-x-auto px-5 py-2 sm:px-8">
        <Link className="shrink-0 font-mono text-[10px] uppercase text-gold-light" href={menu.home} title={menu.tagline}>{menu.label}</Link>
        <ul className="flex items-center gap-1">
          {menu.items.filter((item) => !item.more || open || current?.href === item.href).map((item) => (
            <li key={item.href}>
              <Link aria-current={current?.href === item.href ? "page" : undefined} className={`inline-flex min-h-9 items-center whitespace-nowrap px-3 text-sm ${current?.href === item.href ? "border-b-2 border-gold text-gold-light" : "text-cream/80 hover:text-gold-light"}`} href={item.href} title={item.hint}>
                {item.label}
              </Link>
            </li>
          ))}
          {menu.items.some((item) => item.more) ? (
            <li>
              <button aria-expanded={open} className="inline-flex min-h-9 items-center whitespace-nowrap px-3 text-sm text-cream/60 hover:text-gold-light" onClick={() => setOpen((value) => !value)} type="button">{open ? "Less" : "More"}</button>
            </li>
          ) : null}
        </ul>
        {available.length > 1 ? (
          <label className="ml-auto flex shrink-0 items-center gap-2 text-xs text-cream/60">
            View as
            <select className="border border-cream/25 bg-ink px-2 py-1 text-xs text-cream" onChange={(event) => { const next = event.target.value as Persona; choose(next); window.location.assign(PERSONA_MENUS[next].home); }} value={persona}>
              {available.map((item) => <option key={item} value={item}>{PERSONA_MENUS[item].label}</option>)}
            </select>
          </label>
        ) : persona === "learner" ? (
          <Link className="ml-auto shrink-0 text-xs text-cream/60 underline underline-offset-4 hover:text-gold-light" href="/contribute">Want to teach?</Link>
        ) : null}
      </div>
      {step && step.href !== pathname ? (
        <p className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 border-t border-cream/10 px-5 py-2 text-sm sm:px-8" role="status">
          <span className="font-mono text-[10px] uppercase text-gold-light">Arya suggests</span>
          <span className="text-cream/85">{step.text}</span>
          <Link className="font-semibold text-gold-light underline underline-offset-4" href={step.href}>{step.action}</Link>
        </p>
      ) : null}
    </nav>
  );
}
