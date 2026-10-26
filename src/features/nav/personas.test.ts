import { describe, expect, it } from "vitest";

import { PERSONA_MENUS, activeItem, homeFor, personaOfPath, personasFor, primaryPersona } from "./personas";

describe("role menus", () => {
  it("gives a plain learner only the learner menu, with a roadmap, the role explorer, a learning path and training material", () => {
    expect(personasFor([])).toEqual(["learner"]);
    expect(personasFor(undefined)).toEqual(["learner"]);
    expect(PERSONA_MENUS.learner.items.map((item) => item.label)).toEqual(["My roadmap", "Explore roles", "Learning path", "Training material"]);
  });

  it("gives each other kind of person what they work with, and nothing from the other menus", () => {
    expect(PERSONA_MENUS.coach.items.map((item) => item.label)).toEqual(["Interview", "My lessons", "Earnings calculator"]);
    expect(PERSONA_MENUS.editor.items[0].label).toBe("Content to approve");
    expect(PERSONA_MENUS.admin.items.map((item) => item.label)).toEqual(expect.arrayContaining(["Dashboard", "Accounts", "Payments", "Earnings and policy"]));
    const own = (persona: keyof typeof PERSONA_MENUS) => PERSONA_MENUS[persona].items.map((item) => item.href);
    expect(own("learner")).not.toContain("/contribute/earnings");
    expect(own("coach")).not.toContain("/admin/payments");
  });

  it("works out which menus a person may use from their roles, most senior first", () => {
    expect(personasFor(["contributor"])).toEqual(["coach", "learner"]);
    expect(personasFor(["editor"])).toEqual(["editor", "learner"]);
    expect(personasFor(["admin"])).toEqual(["admin", "editor", "coach", "learner"]);
    expect(personasFor(["contributor", "editor"])).toEqual(["editor", "coach", "learner"]);
    expect(personasFor(["something-else"])).toEqual(["learner"]);
  });

  it("opens each person on their own home", () => {
    expect(homeFor([])).toBe("/learn");
    expect(homeFor(["contributor"])).toBe("/contribute/dashboard");
    expect(homeFor(["editor"])).toBe("/contribute/editor");
    expect(homeFor(["admin"])).toBe("/admin");
    expect(primaryPersona(["admin"])).toBe("admin");
  });

  it("knows which menu a page belongs to and which item is current", () => {
    expect(personaOfPath("/contribute/admin/users")).toBe("admin");
    expect(personaOfPath("/admin/payments")).toBe("admin");
    expect(personaOfPath("/contribute/editor")).toBe("editor");
    expect(personaOfPath("/contribute/abc/review")).toBe("coach");
    expect(personaOfPath("/skill-shots/root-cause-five-whys")).toBe("learner");
    expect(personaOfPath("/arya")).toBeNull();
    expect(activeItem(PERSONA_MENUS.admin, "/contribute/admin/users")?.label).toBe("Accounts");
    expect(activeItem(PERSONA_MENUS.admin, "/contribute/admin")?.label).toBe("Earnings and policy");
    expect(activeItem(PERSONA_MENUS.learner, "/skill-shots/x")).toBeNull();
  });
});
