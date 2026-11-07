import { ArrowRight, Award, Clock, Compass, Home, Landmark, Users, Zap } from "lucide-react";
import Link from "next/link";

/** The promises FutureSkilz makes, in plain words. Claims here must stay true of the product as it is today. */
const PILLARS = [
  { icon: Clock, title: "Learn any time, anywhere", body: "Short lessons that fit around your day. Pause, and pick up exactly where you stopped. Your progress follows you to any device." },
  { icon: Users, title: "Everyone can teach", body: "Every professional carries knowledge worth passing on. Arya, our AI interviewer, draws it out in conversation; you approve every word before anyone sees it." },
  { icon: Award, title: "Anyone can be the best, from the best", body: "Learn from people who have actually done the work, in their own words: the judgement, the shortcuts and the mistakes that books leave out." },
  { icon: Compass, title: "Guided learning", body: "Know where you want to go, see where you stand, and follow a short path that closes the gap. One clear next step at a time." },
  { icon: Zap, title: "Learn when you need it", body: "Practical learning at the moment of need: a new role, a handover, a hard decision. Organisations can use it to move knowledge from one person or team to the next." },
  { icon: Home, title: "Teach and earn from home", body: "Senior professionals can give their experience a second life. No studio, no equipment and no marketing needed: you talk, and learners find your lessons. You earn a transparent share when they are used." },
] as const;

export function HomeHero() {
  return (
    <section aria-labelledby="hero-title" className="border-b border-border bg-ink text-cream">
      <div className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="font-mono text-[11px] uppercase text-gold-light">The gurukul way, for the working world</p>
        <h1 className="mt-4 max-w-4xl font-display text-4xl font-semibold leading-tight sm:text-6xl" id="hero-title">
          Anyone can be the best, <span className="text-gold-light">from the best.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-lg leading-8 text-cream/75">
          FutureSkilz turns the hard-won knowledge of experienced professionals into short, practical lessons, and guides you from where you are to where you want to be.
        </p>
        <ul className="mt-6 flex flex-wrap gap-2 text-sm text-cream/85">
          {["Learn any time, anywhere", "Everyone can teach", "Guided learning", "Learn when you need it"].map((chip) => (
            <li key={chip} className="border border-cream/25 px-3 py-1.5">{chip}</li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <a className="primary-button" href="#start">Start learning <ArrowRight aria-hidden="true" size={16} /></a>
          <Link className="inline-flex min-h-12 items-center gap-2 border border-gold px-5 font-semibold text-gold-light hover:bg-gold/10" href="/join?as=coach">Share what you know</Link>
          <Link className="inline-flex min-h-12 items-center px-2 text-sm text-cream/80 underline underline-offset-4 hover:text-cream" href="/arya">Meet Arya, your guide</Link>
        </div>
      </div>
    </section>
  );
}

export function ValuePillars() {
  return (
    <section aria-labelledby="why-title" className="border-t border-border bg-cream">
      <div className="mx-auto w-full max-w-7xl px-5 py-14 sm:px-8 sm:py-20">
        <p className="font-mono text-[10px] uppercase text-gold">Why FutureSkilz</p>
        <h2 className="mt-2 max-w-3xl font-display text-3xl font-semibold leading-tight sm:text-5xl" id="why-title">Learning that works the way experience does.</h2>
        <ul className="mt-10 grid gap-px border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {PILLARS.map((pillar) => (
            <li key={pillar.title} className="bg-surface p-6">
              <pillar.icon aria-hidden="true" className="text-gold" size={26} />
              <h3 className="mt-4 font-display text-2xl leading-snug">{pillar.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-mid">{pillar.body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-4 max-w-3xl text-xs leading-5 text-ink-light">Earnings follow a published policy and depend on how often lessons are used. Nothing is paid out until the policy is approved, and nothing is published without the expert&apos;s own review.</p>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Capture", body: "An experienced professional talks through their career. Arya listens, asks one question at a time, and keeps the exact words." },
  { title: "Verify", body: "The expert reviews what was heard, corrects it and decides what is shared. Authenticity stays with the person who earned it." },
  { title: "Pass on", body: "Their knowledge becomes short lessons for the next generation, with the expert's name on them." },
] as const;

export function GurukulBand() {
  return (
    <section aria-labelledby="gurukul-title" className="bg-ink text-cream">
      <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div>
          <Landmark aria-hidden="true" className="text-gold-light" size={30} />
          <p className="mt-4 font-mono text-[11px] uppercase text-gold-light">The gurukul way</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-tight sm:text-5xl" id="gurukul-title">A nation builds itself when knowledge is passed on.</h2>
          <p className="mt-5 text-base leading-7 text-cream/75">
            In the gurukul, a learner sat beside the teacher and absorbed what no book holds: judgement, timing, how to handle people. That knowledge is mostly unwritten. When experienced people retire or move on, it leaves with them.
          </p>
          <p className="mt-4 text-base leading-7 text-cream/75">
            FutureSkilz brings the gurukul to the working world. It moves that unwritten knowledge from one generation to the next, for individuals who want to grow and for organisations that cannot afford to lose what their people know.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="primary-button" href="/join?as=coach">Pass on what you know <ArrowRight aria-hidden="true" size={16} /></Link>
            <Link className="inline-flex min-h-12 items-center border border-cream/30 px-5 text-sm hover:border-gold" href="/join?as=coach">Plan a knowledge handover</Link>
          </div>
        </div>
        <ol className="grid content-start gap-4">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex gap-4 border border-cream/15 p-5">
              <span className="font-display text-4xl text-gold-light">{index + 1}</span>
              <span>
                <span className="block font-display text-2xl">{step.title}</span>
                <span className="mt-1 block text-sm leading-6 text-cream/70">{step.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
