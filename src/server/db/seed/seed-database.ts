import { and, eq, inArray } from "drizzle-orm";
import type { MySql2Database } from "drizzle-orm/mysql2";

import * as schema from "../schema";
import { roles, roleSkills, skillRelationships, skills } from "../schema";
import { seedRoles, seedSkillRelationships, seedSkills } from "./catalog";

export async function seedDatabase(database: MySql2Database<typeof schema>) {
  return database.transaction(async (transaction) => {
    for (const skill of seedSkills) {
      await transaction
        .insert(skills)
        .values({ ...skill, parentSkillId: null, type: "capability", version: 1, status: "active" })
        .onDuplicateKeyUpdate({
          set: { name: skill.name, category: skill.category, description: skill.description, parentSkillId: null, type: "capability", status: "active" },
        });
    }

    for (const role of seedRoles) {
      await transaction
        .insert(roles)
        .values({
          title: role.title,
          slug: role.slug,
          function: role.function,
          description: role.description,
        })
        .onDuplicateKeyUpdate({
          set: { title: role.title, function: role.function, description: role.description },
        });
    }

    const persistedSkills = await transaction
      .select({ id: skills.id, slug: skills.slug })
      .from(skills)
      .where(and(eq(skills.version, 1), inArray(skills.slug, seedSkills.map(({ slug }) => slug))));
    const persistedRoles = await transaction
      .select({ id: roles.id, slug: roles.slug })
      .from(roles)
      .where(inArray(roles.slug, seedRoles.map(({ slug }) => slug)));
    const skillIds = new Map(persistedSkills.map(({ id, slug }) => [slug, id]));
    const roleIds = new Map(persistedRoles.map(({ id, slug }) => [slug, id]));

    for (const role of seedRoles) {
      const roleId = roleIds.get(role.slug);
      if (!roleId) throw new Error(`Seeded role was not persisted: ${role.slug}`);

      for (const requirement of role.requiredSkills) {
        const skillId = skillIds.get(requirement.skillSlug);
        if (!skillId) throw new Error(`Seeded skill was not persisted: ${requirement.skillSlug}`);

        await transaction
          .insert(roleSkills)
          .values({ roleId, skillId, targetLevel: requirement.targetLevel, required: true })
          .onDuplicateKeyUpdate({
            set: { targetLevel: requirement.targetLevel, required: true },
          });
      }
    }

    for (const relationship of seedSkillRelationships) {
      const sourceSkillId = skillIds.get(relationship.sourceSkillSlug);
      const targetSkillId = skillIds.get(relationship.targetSkillSlug);
      if (!sourceSkillId || !targetSkillId) {
        throw new Error(`Seed relationship references an unknown skill: ${relationship.sourceSkillSlug} -> ${relationship.targetSkillSlug}`);
      }

      await transaction
        .insert(skillRelationships)
        .values({
          sourceSkillId,
          targetSkillId,
          relationshipType: relationship.relationshipType,
          weight: relationship.weight,
        })
        .onDuplicateKeyUpdate({ set: { weight: relationship.weight } });
    }

    return {
      skills: persistedSkills.length,
      roles: persistedRoles.length,
      roleSkillRequirements: seedRoles.reduce((total, role) => total + role.requiredSkills.length, 0),
      skillRelationships: seedSkillRelationships.length,
    };
  });
}