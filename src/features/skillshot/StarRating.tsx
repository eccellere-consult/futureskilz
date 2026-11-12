"use client";

import { Star } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { STAR_WORDS, ratingLabel, type RatingSummary } from "./rating";

function learnerKey(): string {
  try {
    const existing = window.localStorage.getItem("fs-learner-key");
    if (existing) return existing;
    const fresh = crypto.randomUUID();
    window.localStorage.setItem("fs-learner-key", fresh);
    return fresh;
  } catch {
    return crypto.randomUUID();
  }
}

/** Stars that only show a score. Half stars are not drawn: the number beside them carries the exact average. */
export function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span aria-hidden="true" className="inline-flex gap-0.5 align-middle">
      {[1, 2, 3, 4, 5].map((star) => <Star key={star} className={star <= Math.round(value) ? "fill-gold text-gold" : "text-ink-light/50"} size={size} />)}
    </span>
  );
}

/** One line for a card or a list: the stars, the average and how many rated. Nothing at all until someone has rated. */
export function RatingLine({ summary, className = "" }: { summary?: RatingSummary | null; className?: string }) {
  const label = ratingLabel(summary);
  if (!label || !summary?.average) return null;
  return <span className={`inline-flex items-center gap-1.5 text-xs text-ink-mid ${className}`}><Stars size={13} value={summary.average} /><span className="sr-only">{label}</span><span aria-hidden="true">{summary.average.toFixed(1)} ({summary.count})</span></span>;
}

/** The learner's own rating at the end of a Skill Shot: tap a star and it is saved; a comment is optional. */
export function StarRating({ slug }: { slug: string }) {
  const key = useRef("");
  const [mine, setMine] = useState(0);
  const [hover, setHover] = useState(0);
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [comment, setComment] = useState("");
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    key.current = learnerKey();
    let live = true;
    fetch(`/api/skill-shots/${encodeURIComponent(slug)}/rating?learnerKey=${encodeURIComponent(key.current)}`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { summary?: RatingSummary; mine?: number | null } | null) => {
        if (!live || !body) return;
        setSummary(body.summary ?? null);
        if (body.mine) setMine(body.mine);
      })
      .catch(() => undefined);
    return () => { live = false; };
  }, [slug]);

  async function save(rating: number, withComment = false) {
    setMine(rating);
    setState("saving");
    try {
      const response = await fetch(`/api/skill-shots/${encodeURIComponent(slug)}/rating`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rating, learnerKey: key.current, ...(withComment || comment.trim() ? { comment } : {}) }) });
      const body = (await response.json().catch(() => ({}))) as { summary?: RatingSummary; error?: string };
      if (!response.ok) throw new Error(body.error || "Your rating could not be saved. Please try again.");
      if (body.summary) setSummary(body.summary);
      setState("saved");
      setMessage(withComment ? "Thank you. Your comment is saved." : "Thank you. Your rating is saved; tap another star to change it.");
    } catch (caught) {
      setState("error");
      setMessage(caught instanceof Error ? caught.message : "Your rating could not be saved. Please try again.");
    }
  }

  const shown = hover || mine;
  const overall = ratingLabel(summary);
  return (
    <section aria-label="Rate this Skill Shot" className="mt-10 border border-border bg-surface p-5">
      <h2 className="font-display text-2xl">How useful was this Skill Shot?</h2>
      <p className="mt-1 text-sm text-ink-mid">One tap. Your rating tells us what to improve.</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <div aria-label="Your rating" className="flex" onMouseLeave={() => setHover(0)} role="radiogroup">
          {[1, 2, 3, 4, 5].map((star) => (
            <button aria-checked={mine === star} aria-label={`${star} star${star === 1 ? "" : "s"}: ${STAR_WORDS[star]}`} className="flex size-12 items-center justify-center" disabled={state === "saving"} key={star} onClick={() => void save(star)} onFocus={() => setHover(star)} onBlur={() => setHover(0)} onMouseEnter={() => setHover(star)} role="radio" type="button">
              <Star aria-hidden="true" className={star <= shown ? "fill-gold text-gold" : "text-ink-light"} size={32} />
            </button>
          ))}
        </div>
        <p aria-live="polite" className="min-h-5 text-sm font-semibold">{shown ? STAR_WORDS[shown] : ""}</p>
      </div>
      {mine ? (
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(event) => { event.preventDefault(); void save(mine, true); }}>
          <label className="sr-only" htmlFor={`rating-comment-${slug}`}>What would make it better? (optional)</label>
          <input className="min-h-11 w-full border border-border bg-cream px-3 text-sm" id={`rating-comment-${slug}`} maxLength={600} onChange={(event) => setComment(event.target.value)} placeholder="What would make it better? (optional)" value={comment} />
          <button className="min-h-11 shrink-0 border border-ink px-4 text-sm font-semibold disabled:opacity-50" disabled={state === "saving" || !comment.trim()} type="submit">Send comment</button>
        </form>
      ) : null}
      {message ? <p className={`mt-2 text-sm ${state === "error" ? "text-crimson" : "text-teal"}`} role={state === "error" ? "alert" : "status"}>{message}</p> : null}
      {overall && summary?.average ? <p className="mt-3 flex items-center gap-2 text-sm text-ink-mid"><Stars value={summary.average} /> {overall}. Ratings are learners&apos; opinions, not a measure of what was learned.</p> : null}
    </section>
  );
}
