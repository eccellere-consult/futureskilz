/**
 * How much human review a piece of content needs before learners see it, chosen by risk (Master Build, governance modes A, B, C).
 * Rules, not a model, so the reasons can be shown. The automatic checks look at structure, not whether the teaching is right, so
 * fully autonomous publishing is switched off: Mode A means one editor's sign-off, not none.
 *
 *  Mode A: automatic checks, then one editor publishes. For low-risk, structured content.
 *  Mode B: automatic checks, the coach approves their own words, then an editor publishes.
 *  Mode C: automatic checks, an editor reviews as the subject expert, and an admin approves and publishes. For sensitive,
 *          regulated, enterprise-sensitive or low-confidence content.
 */
export type GovernanceMode = "A" | "B" | "C";

export type RiskInputs = {
  /** Title, objective and any notes the content was made from. */
  text: string;
  sourceKind: "illustrative" | "method" | "design" | "expert-interview" | "document";
  /** Figures, results or claims about real organisations or people appear in the content. */
  hasRealClaims: boolean;
  /** Built from a coach's own lesson, so the coach has to approve the new wording. */
  fromCoach: boolean;
  newContributor: boolean;
  enterpriseSensitive: boolean;
  /** 0 to 1: how sure the automatic checks and the source make us (a scaffold or failed checks is low). */
  confidence: number;
};

export type Governance = { mode: GovernanceMode; risk: "low" | "medium" | "high"; reasons: string[]; steps: string[] };

const REGULATED: Array<[RegExp, string]> = [
  [/\b(legal|law|lawsuit|contract clause|compliance|regulat\w+|statutory)\b/i, "legal or regulatory"],
  [/\b(medical|clinical|diagnos\w+|medication|patient|health advice)\b/i, "medical"],
  [/\b(invest\w*|tax|loan|insurance|securities|financial advice)\b/i, "financial advice"],
  [/\b(safety[- ]critical|hazard\w*|chemical|explosive|confined space|lockout)\b/i, "safety-critical"],
  [/\b(dismiss\w*|harass\w*|discriminat\w+|disciplinary|grievance|termination)\b/i, "employment law"],
  [/\b(personal data|dpdp|gdpr|data protection|privacy law)\b/i, "data protection"],
];
const SENSITIVE: Array<[RegExp, string]> = [
  [/\b(security|cyber\w*|password|breach|confidential\w*)\b/i, "security"],
  [/\b(ethic\w*|bias|fairness|responsible ai|ai governance)\b/i, "ethics and governance"],
];

export function governanceFor(input: RiskInputs): Governance {
  const reasons: string[] = [];
  let points = 0;
  let forceC = false;

  const regulated = REGULATED.filter(([pattern]) => pattern.test(input.text)).map(([, label]) => label);
  if (regulated.length) {
    reasons.push(`The topic touches ${regulated.join(" and ")}, where a wrong or careless statement can cause harm.`);
    points += 4;
    forceC = true;
  }
  const sensitive = SENSITIVE.filter(([pattern]) => pattern.test(input.text)).map(([, label]) => label);
  if (sensitive.length) {
    reasons.push(`The topic touches ${sensitive.join(" and ")}, which deserves a careful second look.`);
    points += 2;
  }
  if (input.enterpriseSensitive) {
    reasons.push("It is meant for an organisation's own use, where the content may be confidential or contractual.");
    points += 4;
    forceC = true;
  }
  if (input.hasRealClaims) {
    reasons.push("It states figures or results about real organisations or people, which need checking against a source.");
    points += 2;
  }
  if (input.sourceKind === "expert-interview" || input.sourceKind === "document") {
    reasons.push(`It rests on ${input.sourceKind === "document" ? "a document" : "an expert's own account"}, so its claims depend on that source.`);
    points += 1;
  }
  if (input.newContributor) {
    reasons.push("The author has no published work here yet.");
    points += 1;
  }
  if (input.confidence < 0.6) {
    reasons.push("The automatic checks and the source give us low confidence in it.");
    points += 2;
  }

  const risk: Governance["risk"] = forceC || points >= 4 ? "high" : points >= 1 ? "medium" : "low";
  const mode: GovernanceMode = risk === "high" ? "C" : input.fromCoach || risk === "medium" ? "B" : "A";
  if (input.fromCoach) reasons.push("It was built from a coach's own lesson, so the coach approves the new wording.");
  if (reasons.length === 0) reasons.push("Low-risk, structured content from a method or an illustrative case.");

  const steps = mode === "A" ? ["Automatic checks pass", "An editor reviews and publishes"] : mode === "B" ? ["Automatic checks pass", ...(input.fromCoach ? ["The coach approves their own wording"] : ["An editor checks the claims against their source"]), "An editor publishes"] : ["Automatic checks pass", "An editor reviews it as the subject expert", "An admin approves and publishes"];
  return { mode, risk, reasons, steps };
}

export const MODE_LABEL: Record<GovernanceMode, string> = { A: "Mode A: editor sign-off", B: "Mode B: author approval", C: "Mode C: expert review and admin approval" };
