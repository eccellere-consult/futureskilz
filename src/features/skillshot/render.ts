import { clock, sceneSeconds, timeline, totalSeconds } from "./duration";
import { reviewBlueprint } from "./rubric";
import type { Blueprint, Visual } from "./types";

const bullets = (items: string[]): string => items.map((item) => `- ${item}`).join("\n");
const numbered = (items: string[]): string => items.map((item, index) => `${index + 1}. ${item}`).join("\n");

function describeVisual(visual: Visual | undefined): string {
  if (!visual) return "None (Arya and the on-screen lines only).";
  switch (visual.type) {
    case "case-card": return `Case card "${visual.heading}"${visual.label ? ` (${visual.label})` : ""}: ${visual.facts.join("; ")}.`;
    case "compare": return `Comparison table, ${visual.leftTitle} against ${visual.rightTitle}: ${visual.rows.map(([label, left, right]) => `${label}: ${left} | ${right}`).join("; ")}.`;
    case "steps": return `Numbered steps: ${visual.items.join("; ")}.`;
    case "why-chain": return `Why chain for "${visual.problem}": ${visual.links.map((link) => `${link.why} ${link.because}`).join(" ")}${visual.root ? ` ${visual.root}` : ""}`;
    case "checklist": return `Checklist "${visual.title}": ${visual.items.join("; ")}.`;
    case "takeaways": return `Takeaways: ${visual.items.join(" ")}`;
  }
}

/** The seven documents the skill asks for (section 15), made from the blueprint so they always match the lesson. */
export function renderDeliverables(blueprint: Blueprint): Record<string, string> {
  const { meta, design, scenes } = blueprint;
  const times = timeline(blueprint);
  const review = reviewBlueprint(blueprint);
  const minutes = totalSeconds(blueprint) / 60;
  const files: Record<string, string> = {};

  files["skill_shot_blueprint.md"] = `# ${meta.title}

> Draft. ${blueprint.disclosure}

## Metadata
| Field | Value |
|---|---|
| skill_shot_id | ${meta.id} |
| version | ${meta.version} |
| domain | ${meta.domain} |
| function | ${meta.functionName ?? ""} |
| target_audience | ${meta.targetAudience} |
| proficiency_level | ${meta.proficiency} |
| estimated_duration_minutes | ${minutes.toFixed(1)} (from the script and pauses) |
| language | ${meta.language} |
| teaching_pattern | ${meta.teachingPattern}: ${meta.patternReason} |
| prerequisites | ${meta.prerequisites.join("; ")} |
| parent_skill_or_module | ${meta.parentSkill} |
| related_skill_shots | ${meta.relatedSkillShots.join(", ")} |
| source_ids | ${blueprint.sources.map((source) => source.id).join(", ")} |
| contributor_attribution | ${meta.contributorAttribution} |
| review_status | ${meta.reviewStatus} |

## Instructional design
- **learning_need:** ${design.learningNeed}
- **learning_objective:** ${design.learningObjective}
- **success_criteria:**
${bullets(design.successCriteria).replace(/^/gm, "  ")}
- **case_context:** ${design.caseContext}
- **key_concept:** ${design.keyConcept}
- **method_or_framework:** ${design.methodOrFramework}
- **step_by_step_application:**
${numbered(design.stepByStepApplication).replace(/^/gm, "  ")}
- **worked_example:** ${design.workedExample}
- **common_mistakes:**
${bullets(design.commonMistakes).replace(/^/gm, "  ")}
- **limitations_and_caveats:**
${bullets(design.limitationsAndCaveats).replace(/^/gm, "  ")}
- **learner_challenge:** ${design.learnerChallenge}
- **correct_response_and_rationale:** ${scenes.find((scene) => scene.interaction)?.interaction?.rationale ?? ""}
- **workplace_transfer_task:** ${design.workplaceTransferTask}
- **summary_takeaways:**
${bullets(design.summaryTakeaways).replace(/^/gm, "  ")}
- **next_learning_recommendation:**
${bullets(design.nextLearningRecommendation.map((item) => `${item.label}${item.href ? ` (${item.href})` : ""}: ${item.why}`)).replace(/^/gm, "  ")}
`;

  files["narration_script.md"] = `# Narration script: ${meta.title}

Spoken by Arya, an AI teacher. Pace about 145 words a minute, with the pauses shown. Total ${clock(totalSeconds(blueprint))}.

${scenes
  .map((scene, index) => `## Scene ${index + 1} · ${scene.title} (${clock(times[index].start)} to ${clock(times[index].end)})
**Avatar cue:** ${scene.cue}${scene.pauseSeconds ? ` · pause ${scene.pauseSeconds}s after` : ""}${scene.interaction ? ` · learner thinks for ${scene.interaction.thinkSeconds}s` : ""}

${scene.narration}
`)
  .join("\n")}`;

  files["scene_plan.md"] = `# Scene plan: ${meta.title}

${scenes
  .map((scene, index) => `## Scene ${index + 1} · ${scene.title}
- **Time:** ${clock(times[index].start)} to ${clock(times[index].end)} (${sceneSeconds(scene)}s)
- **Purpose:** ${scene.purpose}
- **Section:** ${scene.section}
- **On-screen text:** ${scene.onScreen.join(" / ")}
- **Visual:** ${describeVisual(scene.visual)}
- **Avatar action:** ${scene.cue}
- **Learner interaction:** ${scene.interaction ? `${scene.interaction.prompt} (thinking time ${scene.interaction.thinkSeconds}s)` : "None"}
- **Captions and accessibility:** Captions are the narration. ${scene.accessibility}
- **Sources:** ${scene.sources.join(", ")}
`)
  .join("\n")}`;

  const choice = (options: Array<{ id: string; text: string; feedback: string }>, correctId: string) => options.map((option) => `- ${option.id.toUpperCase()}${option.id === correctId ? " (correct)" : ""}. ${option.text}\n  - Feedback: ${option.feedback}`).join("\n");
  const challenge = scenes.find((scene) => scene.interaction)?.interaction;
  files["knowledge_check.md"] = `# Knowledge check: ${meta.title}

## In-lesson challenge
${challenge ? `${challenge.prompt}\n\n${choice(challenge.options, challenge.correctId)}\n\n**Why:** ${challenge.rationale}` : "None."}

## Questions after the lesson
${blueprint.knowledgeCheck.map((question, index) => `### ${index + 1}. ${question.prompt}\n${choice(question.options, question.correctId)}\n\n**Why:** ${question.why}`).join("\n\n")}
`;

  files["source_map.md"] = `# Source map: ${meta.title}

## Sources
${blueprint.sources.map((source) => `- **${source.id}** (${source.kind}): ${source.label}${source.where ? ` Where: ${source.where}` : ""}`).join("\n")}

## Claims by scene
${scenes.map((scene, index) => `- Scene ${index + 1} (${scene.title}): ${scene.sources.join(", ")}`).join("\n")}

No figures, quotations, company names or outcomes are used. The cases are illustrative and are labelled as such on screen.
`;

  files["review_checklist.md"] = `# Review checklist: ${meta.title}

Status: **${meta.reviewStatus}**. Automatic checks ${review.passes ? "passed" : "found problems"}. A person must still review and approve before publication.

## Automatic checks (estimated length ${review.durationMinutes} minutes)
${review.findings.map((finding) => `- ${finding.criterion}: ${finding.score}/5${finding.notes.length || finding.critical.length ? ` (${[...finding.critical, ...finding.notes].join(" ")})` : ""}`).join("\n")}

## A person must check
- [ ] Teaching quality: is the explanation clear without being misleading?
- [ ] Accuracy of the method for your setting, and of every example.
- [ ] The illustrative case is realistic and labelled as made up.
- [ ] Rights and consent: attribution, AI disclosure and voice.
- [ ] Accessibility in practice: captions, keyboard use, contrast, reading order.
- [ ] Timing with a real learner, not only the estimate.
- [ ] Approval recorded with the version and the reviewer's name.
`;

  files["learning_path_entry.md"] = `# Learning path entry: ${meta.title}

- **Skill Shot:** ${meta.title} (${meta.id}, version ${meta.version})
- **Skill Set:** ${blueprint.learningPath.skillSet}
- **Capability Module:** ${blueprint.learningPath.capabilityModule}
- **Role or domain path:** ${blueprint.learningPath.rolePath}
- **Position:** ${blueprint.learningPath.position}
- **Prerequisites:** ${meta.prerequisites.join("; ")}
- **After this the learner can:** ${design.learningObjective}

## Next
${bullets(design.nextLearningRecommendation.map((item) => `${item.label}${item.href ? ` (${item.href})` : ""}: ${item.why}`))}
`;
  return files;
}
