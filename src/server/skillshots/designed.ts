import "server-only";

import { getDesignedSkillShot } from "@/features/skillshot";
import type { Blueprint } from "@/features/skillshot/types";

import { getPublishedBlueprint } from "./service";

/** A designed Skill Shot a learner may open: one built into the product, or one an editor published. A failed lookup is simply "not found". */
export async function findDesigned(id: string): Promise<Blueprint | undefined> {
  return getDesignedSkillShot(id) ?? (await getPublishedBlueprint(id).catch(() => null)) ?? undefined;
}
