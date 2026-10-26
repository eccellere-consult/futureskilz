import { createHash } from "node:crypto";

/** A public, opaque address for a coach, so the page address never shows an account id. */
export const coachProfileId = (userId: string): string => createHash("sha256").update(`coach:${userId}`).digest("hex").slice(0, 16);
