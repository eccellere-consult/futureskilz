import type { Blueprint, Scene } from "./types";

/** A calm teaching pace. The lesson length comes from the actual script and pauses, not from a title or a guess. */
export const WORDS_PER_MINUTE = 145;

export const wordCount = (text: string): number => (text.trim().match(/\S+/g) ?? []).length;

export function sceneSeconds(scene: Pick<Scene, "narration" | "pauseSeconds" | "interaction">): number {
  const speech = (wordCount(scene.narration) / WORDS_PER_MINUTE) * 60;
  const think = scene.interaction ? scene.interaction.thinkSeconds : 0;
  return Math.round(speech + scene.pauseSeconds + think);
}

/** Start and end of each scene, in seconds from the beginning. */
export function timeline(blueprint: Pick<Blueprint, "scenes">): Array<{ id: string; start: number; end: number }> {
  let at = 0;
  return blueprint.scenes.map((scene) => {
    const start = at;
    at += sceneSeconds(scene);
    return { id: scene.id, start, end: at };
  });
}

export const totalSeconds = (blueprint: Pick<Blueprint, "scenes">): number => blueprint.scenes.reduce((sum, scene) => sum + sceneSeconds(scene), 0);

export const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;
