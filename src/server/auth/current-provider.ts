import "server-only";

import { cookies } from "next/headers";

import { createDatabase } from "@/server/db/client";
import { getServerEnvironment } from "@/server/env";

import { DatabaseSessionRepository } from "./database-session-repository";
import { PersistedSessionProvider } from "./persisted-provider";
import { type AuthProvider, UnauthenticatedProvider } from "./provider";
import { sessionCookieName } from "./session-cookie";

export async function createCurrentAuthProvider(): Promise<AuthProvider> {
  const environment = getServerEnvironment();
  const token = (await cookies()).get(sessionCookieName)?.value;

  if (!token || !environment.SESSION_SECRET) return new UnauthenticatedProvider();

  return new PersistedSessionProvider(
    token,
    environment.SESSION_SECRET,
    new DatabaseSessionRepository(createDatabase()),
  );
}