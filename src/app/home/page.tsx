import { redirect } from "next/navigation";

import { homeFor } from "@/features/nav/personas";
import { requireMember } from "@/server/auth/require-member";

export const dynamic = "force-dynamic";

/** One address that sends each person to their own home: learners to their learning, coaches to their lessons, and so on. */
export default async function HomeRedirect() {
  const session = await requireMember("/home");
  redirect(homeFor(session.user.roles));
}
