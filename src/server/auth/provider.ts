import "server-only";

export type AuthenticatedUser = {
  id: string;
  email: string;
  displayName: string;
  organizationId: string | null;
  roles: string[];
};

export type AuthSession = {
  sessionId?: string;
  user: AuthenticatedUser;
  expiresAt: Date;
};

export interface AuthProvider {
  getSession(): Promise<AuthSession | null>;
  signOut(): Promise<void>;
}

export class UnauthenticatedProvider implements AuthProvider {
  async getSession(): Promise<null> {
    return null;
  }

  async signOut(): Promise<void> {}
}

export async function requireSession(provider: AuthProvider): Promise<AuthSession> {
  const session = await provider.getSession();

  if (!session) {
    throw new Error("Authentication required.");
  }

  return session;
}
