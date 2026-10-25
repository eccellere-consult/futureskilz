import "server-only";

import { redirect } from "next/navigation";

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
