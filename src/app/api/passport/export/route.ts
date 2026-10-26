import { toCsv } from "@/features/passport/model";
import { currentSession, noStore, unauthorized } from "@/server/learning/service";
import { buildPassport } from "@/server/passport/service";

export const dynamic = "force-dynamic";

/** The learner's own passport, as a file: ?format=csv (skills, for a spreadsheet) or ?format=json (everything in it). */
export async function GET(request: Request) {
  const session = await currentSession();
  if (!session) return unauthorized();
  const passport = await buildPassport(session.user.id);
  const stamp = passport.generatedAt.slice(0, 10);
  if (new URL(request.url).searchParams.get("format") === "json") {
    return new Response(JSON.stringify(passport, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="skill-passport-${stamp}.json"`, ...noStore } });
  }
  return new Response(toCsv(passport), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="skill-passport-${stamp}.csv"`, ...noStore } });
}
