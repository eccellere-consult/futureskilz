import type { SkillShot } from "./model";

export type Slide = { id: string; kicker: string; title: string; body: string; narration: string };

/** A Skill Shot as five short slides that Arya teaches. The words are the Skill Shot's own; Arya only adds the signposts. */
export function skillShotSlides(skillShot: SkillShot): Slide[] {
  return [
    {
      id: "intro",
      kicker: `Skill Shot · ${skillShot.durationMinutes} minutes`,
      title: skillShot.title,
      body: skillShot.objective,
      narration: `Today's Skill Shot: ${skillShot.title}. By the end, you will be able to do this: ${skillShot.objective}`,
    },
    { id: "why", kicker: "Why it matters", title: "Why this matters", body: skillShot.whyItMatters, narration: `First, why this matters. ${skillShot.whyItMatters}` },
    { id: "technique", kicker: "The technique", title: "The technique", body: skillShot.concept, narration: `Here is the technique. ${skillShot.concept}` },
    { id: "example", kicker: "In practice", title: "What it looks like", body: skillShot.example, narration: `Here is what it looks like in practice. ${skillShot.example}` },
    { id: "practice", kicker: "Your turn", title: "Try it now", body: skillShot.practicePrompt, narration: `Now it is your turn. ${skillShot.practicePrompt} Write a short note below, then answer the check-in question.` },
  ];
}
