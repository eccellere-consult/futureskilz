import { describe, expect, it } from "vitest";

import { escapeHtml, renderEmail, renderSignInEmail } from "./templates";

describe("sign-in email", () => {
  it("names the next Skill Shot and carries the link in both parts", () => {
    const email = renderSignInEmail({
      name: "Priya",
      link: "https://futureskilz.in/auth/verify#token=abc&x=1",
      nextSkillShot: "Test the assumption underneath",
    });

    expect(email.subject).toBe("Your FutureSkilz profile is ready to keep");
    expect(email.text).toContain("Your next Skill Shot is waiting: Test the assumption underneath.");
    expect(email.text).toContain("https://futureskilz.in/auth/verify#token=abc&x=1");
    expect(email.html).toContain('href="https://futureskilz.in/auth/verify#token=abc&amp;x=1"');
    expect(email.html).toContain("expires in 15 minutes");
  });

  it("escapes learner-supplied text", () => {
    const email = renderSignInEmail({ name: '<script>alert("x")</script>', link: "https://futureskilz.in/auth/verify?token=t" });
    expect(email.html).not.toContain("<script>");
    expect(email.html).toContain("&lt;script&gt;");
    expect(escapeHtml(`"'&`)).toBe("&quot;&#39;&amp;");
  });

  it("greets returning learners without a Skill Shot and rejects unknown templates", () => {
    const email = renderEmail("auth.sign-in", { name: "", link: "https://futureskilz.in/auth/verify?token=t" });
    expect(email.subject).toBe("Your FutureSkilz sign-in link");
    expect(email.text.startsWith("Hi there,")).toBe(true);
    expect(() => renderEmail("marketing.blast", {})).toThrow("Unknown email template");
  });
});
