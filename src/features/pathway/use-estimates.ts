"use client";

import { useEffect, useMemo, useState } from "react";

import { scoreDiagnostic } from "../diagnostic/engine";
import { loadDiagnosticAnswers } from "../diagnostic/store";
import type { LearnerSnapshot } from "../learner/draft";
import { loadGuestPassed } from "../skillshot/store";
import { designedById } from "./assets";
import { estimateSkills, type Evidence, type SkillEstimate } from "./estimate";

/**
 * What we think the learner can do, per skill, from every source there is. Signed in, the account holds the levels. As a guest,
 * answers and passes kept on this device count, and are labelled as device-only evidence by their source.
 */
export function useLearnerEstimates(snapshot: LearnerSnapshot): Map<string, SkillEstimate> {
  const [guestDiagnostic, setGuestDiagnostic] = useState<NonNullable<LearnerSnapshot["diagnostic"]>>([]);
  useEffect(() => {
    if (snapshot.account) return;
    void loadDiagnosticAnswers().then(({ answers }) => setGuestDiagnostic(scoreDiagnostic(answers).skills));
  }, [snapshot.account]);

  return useMemo(() => {
    const guest: Evidence[] = snapshot.account ? [] : loadGuestPassed().flatMap((id) => (designedById(id)?.meta.skillMap ?? []).map(({ skill, toLevel }) => ({ skill, correct: true, ceiling: toLevel })));
    return estimateSkills(snapshot.scores, guest, snapshot.skillLevels ?? [], snapshot.account ? (snapshot.diagnostic ?? []) : guestDiagnostic);
  }, [snapshot.account, snapshot.scores, snapshot.skillLevels, snapshot.diagnostic, guestDiagnostic]);
}
