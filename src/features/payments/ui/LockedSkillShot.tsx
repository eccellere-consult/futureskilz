import Link from "next/link";

/** Shown instead of a Skill Shot that needs a pass. It says why and where to go, and never traps the learner. */
export function LockedSkillShot() {
  return (
    <div className="mx-auto max-w-2xl px-5 py-16">
      <p className="font-mono text-[10px] uppercase text-teal">Needs a pass</p>
      <h1 className="mt-2 font-display text-4xl">This Skill Shot is part of a pass</h1>
      <p className="mt-3 text-ink-mid">The first Skill Shots in every area are free. This one opens with a pass, which unlocks all of them for a set time. Prices include GST and you get an invoice.</p>
      <div className="mt-6 flex flex-wrap gap-4"><Link className="primary-button" href="/pricing">See plans</Link><Link className="text-teal underline underline-offset-4" href="/training">Back to the free Skill Shots</Link></div>
    </div>
  );
}
