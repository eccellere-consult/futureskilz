import { describe, expect, it } from "vitest";

import { skillShots } from "./model";
import { skillShotSlides } from "./slides";

describe("Skill Shot slides", () => {
  it("turns every Skill Shot into five slides in teaching order, using only its own words", () => {
    for (const shot of skillShots) {
      const slides = skillShotSlides(shot);
      expect(slides.map((slide) => slide.id)).toEqual(["intro", "why", "technique", "example", "practice"]);
      expect(slides[1].body).toBe(shot.whyItMatters);
      expect(slides[2].body).toBe(shot.concept);
      expect(slides[3].body).toBe(shot.example);
      expect(slides[4].body).toBe(shot.practicePrompt);
      for (const slide of slides) {
        expect(slide.narration.length).toBeGreaterThan(slide.body.length - 1);
        expect(slide.narration).toContain(slide.body);
      }
    }
  });
});
