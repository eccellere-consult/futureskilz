export const sessionCookieName = "futureskilz_session";

export function sessionCookieOptions(isProduction: boolean, expiresAt?: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: isProduction,
    path: "/",
    ...(expiresAt ? { expires: expiresAt } : {}),
  };
}