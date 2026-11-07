import "server-only";

import { redirect } from "next/navigation";

import { homeFor } from "@/features/nav/personas";

import { createCurrentAuthProvider } from "./current-provider";

/**
 * Members-only pages: someone who is not signed in is sent to register or sign in, then returned to the page they wanted.
 * Training kits, the skills journey and the coach tools all sit behind this.
 */
export async function requireMember(returnTo: string) {
  const session = await (await createCurrentAuthProvider()).getSession();
  if (!session) redirect(`/join?next=${encodeURIComponent(returnTo)}`);
  return session;
}

/**
 * Pages for one kind of person. Someone signed in but without the role is sent to their own home instead of an error screen,
 * so a wrong link or an old bookmark never leaves them stranded.
 */
export async function requireRole(returnTo: string, allowed: readonly string[]) {
  const session = await requireMember(returnTo);
  const roles = session.user.roles ?? [];
  if (!allowed.some((role) => roles.includes(role))) redirect(`${homeFor(roles)}?notice=not-for-your-role`);
  return session;
}
