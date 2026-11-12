/**
 * The FutureSkilz lesson standard: how every Skill Shot teaches an adult, and the rule that a lesson teaches directly instead of
 * talking about the file it came from. The same sentences are written in AGENTS.md (the project's instructions) and a test keeps
 * the two in step, so what people are told and what the design agent is told never drift apart.
 */
export const LESSON_STANDARD = [
  "Start from a real workplace need and say why it matters to the learner now.",
  "State one observable outcome: what the learner will be able to do after the lesson.",
  "Connect the idea to what a working adult already knows before adding anything new.",
  "Explain in plain words first, with one analogy, and only then give the proper term (Feynman).",
  "Show one concrete workplace example and one non-example.",
  "Demonstrate the method step by step on a case before asking the learner to use it.",
  "Give the learner one decision to make on a new, related problem, with feedback on every option.",
  "Ask the learner to explain or apply the idea in their own work (teach-back).",
  "End with two to four takeaways, one task to do at work this week, and what to learn next.",
  "Teach one capability per lesson, in short sentences, with no flattery and respect for the learner's experience.",
] as const;

export const DIRECT_TEACHING_RULE =
  "TEACH DIRECTLY: Arya teaches the content as her own lesson. Never mention the document, the material, the reference, the notes, the file, the PDF, the slides, the chapter, the section, the author or what was shared or uploaded, in the narration or on the slide. Say \"A good brief has three parts\", never \"The document says a good brief has three parts\".";

const POINTS_AT_SOURCE = [
  /\b(?:according to|as (?:shared|stated|mentioned|described|noted|given|outlined|explained|covered) in|based on) (?:the|this) (?:[a-z]+ )?(?:document|material|reference|pdf|file|slides|deck|handout|text|notes|content|chapter|section)\b/i,
  /\b(?:the|this) (?:shared|uploaded|provided|attached|reference|source) (?:content|material|document|file|pdf|text|notes|deck|slides)\b/i,
  /\b(?:the|this) (?:document|reference|pdf|material|handout) (?:says|states|explains|describes|mentions|notes|shows|tells|lists|defines|covers|gives|calls|suggests|recommends)\b/i,
];

/** The first phrase in a piece of lesson text that talks about the source instead of teaching, or nothing. */
export function pointsAtSource(text: string): string | null {
  for (const pattern of POINTS_AT_SOURCE) {
    const found = text.match(pattern);
    if (found) return found[0];
  }
  return null;
}
