export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
};

export type SignInEmailVariables = {
  name: string;
  link: string;
  summary?: string;
  nextSkillShot?: string;
};

const palette = {
  ink: "#0e0e0d",
  inkMid: "#3a3935",
  inkLight: "#7a7870",
  gold: "#b8913a",
  goldPale: "#f5edd8",
  cream: "#faf8f4",
  surface: "#fefcf8",
};

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function renderSignInEmail(variables: SignInEmailVariables): RenderedEmail {
  const name = variables.name.trim() || "there";
  const subject = variables.nextSkillShot
    ? "Your FutureSkilz profile is ready to keep"
    : "Your FutureSkilz sign-in link";
  const nextLine = variables.nextSkillShot
    ? `Your next Skill Shot is waiting: ${variables.nextSkillShot}.`
    : "Tap below to pick up where you left off.";

  const text = [
    `Hi ${name},`,
    "",
    variables.summary ? `${variables.summary}\n` : null,
    nextLine,
    "",
    `Continue: ${variables.link}`,
    "",
    "This link works once and expires in 15 minutes. If you did not ask for it, you can ignore this email.",
    "",
    "Arya, FutureSkilz",
  ]
    .filter((line) => line !== null)
    .join("\n");

  const summaryBlock = variables.summary
    ? `<tr><td style="padding:0 40px 24px"><div style="border-left:2px solid ${palette.gold};background:${palette.goldPale};padding:16px 20px;color:${palette.inkMid};font-size:15px;line-height:24px">${escapeHtml(variables.summary)}</div></td></tr>`
    : "";

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;background:${palette.cream};font-family:Arial,Helvetica,sans-serif;color:${palette.ink}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${palette.cream};padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${palette.surface};border-top:3px solid ${palette.gold}">
<tr><td style="background:${palette.ink};padding:24px 40px;font-family:Georgia,serif;font-size:24px;color:${palette.gold}">FutureSkilz.</td></tr>
<tr><td style="padding:32px 40px 16px;font-family:Georgia,serif;font-size:28px;line-height:34px;color:${palette.ink}">Hi ${escapeHtml(name)},</td></tr>
${summaryBlock}
<tr><td style="padding:0 40px 24px;font-size:16px;line-height:26px;color:${palette.inkMid}">${escapeHtml(nextLine)}</td></tr>
<tr><td style="padding:0 40px 32px"><a href="${escapeHtml(variables.link)}" style="display:inline-block;background:${palette.gold};color:${palette.ink};font-weight:bold;font-size:15px;text-decoration:none;padding:14px 24px">Continue to FutureSkilz</a></td></tr>
<tr><td style="padding:0 40px 32px;font-size:13px;line-height:20px;color:${palette.inkLight}">This link works once and expires in 15 minutes. If you did not ask for it, you can ignore this email.<br><br>Arya, FutureSkilz</td></tr>
</table></td></tr></table></body></html>`;

  return { subject, html, text };
}

export function renderBookEmail(variables: { name: string; title: string; pages: string }): RenderedEmail {
  const name = variables.name.trim() || "there";
  const subject = `Your book: ${variables.title}`;
  const text = [`Hi ${name},`, "", `Your book "${variables.title}" is attached as two PDFs (${variables.pages} pages).`, "", "- The interior is the book itself, laid out as a 6 x 9 inch paperback.", "- The cover is the full wrap-around cover for printing.", "", "The book was written from your interview with the help of AI. Please read it before you share it.", "", "Arya, FutureSkilz"].join("\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(subject)}</title></head><body style="margin:0;background:${palette.cream};font-family:Arial,Helvetica,sans-serif;color:${palette.ink}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:${palette.surface};border-top:3px solid ${palette.gold}"><tr><td style="background:${palette.ink};padding:24px 40px;font-family:Georgia,serif;font-size:24px;color:${palette.gold}">FutureSkilz.</td></tr><tr><td style="padding:32px 40px 8px;font-family:Georgia,serif;font-size:26px;line-height:32px">Hi ${escapeHtml(name)},</td></tr><tr><td style="padding:0 40px 24px;font-size:16px;line-height:26px;color:${palette.inkMid}">Your book <strong>${escapeHtml(variables.title)}</strong> is attached as two PDFs (${escapeHtml(variables.pages)} pages): the interior, laid out as a 6 x 9 inch paperback, and the full wrap-around cover.</td></tr><tr><td style="padding:0 40px 32px;font-size:13px;line-height:20px;color:${palette.inkLight}">The book was written from your interview with the help of AI. Please read it before you share it.<br><br>Arya, FutureSkilz</td></tr></table></td></tr></table></body></html>`;
  return { subject, html, text };
}

export function renderEmail(templateKey: string, variables: Record<string, string>): RenderedEmail {
  if (templateKey === "book.ready") return renderBookEmail({ name: variables.name ?? "", title: variables.title ?? "Your book", pages: variables.pages ?? "" });
  if (templateKey === "auth.sign-in") {
    return renderSignInEmail({
      name: variables.name ?? "",
      link: variables.link ?? "",
      summary: variables.summary || undefined,
      nextSkillShot: variables.nextSkillShot || undefined,
    });
  }

  throw new Error(`Unknown email template: ${templateKey}`);
}
