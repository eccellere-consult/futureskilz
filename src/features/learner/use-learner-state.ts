"use client";

import { useCallback, useEffect, useState } from "react";

import { loadLearnerState, type LearnerState } from "./store";

export function useLearnerState() {
  const [state, setState] = useState<LearnerState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      setState(await loadLearnerState());
      setError(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Your profile could not be loaded.");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void reload(), 0);
    return () => window.clearTimeout(timer);
  }, [reload]);

  return { state, error, reload };
}
