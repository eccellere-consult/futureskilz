import type { AuthProvider, AuthSession, AuthenticatedUser } from "./provider";
import { hashSessionToken, verifySessionToken } from "./session-token";

export type PersistedSession = {
  id: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  user: AuthenticatedUser;
};

export interface SessionRepository {
  findById(sessionId: string): Promise<PersistedSession | null>;
  revoke(sessionId: string, revokedAt: Date): Promise<void>;
}

export class PersistedSessionProvider implements AuthProvider {
  constructor(
    private readonly token: string | null,
    private readonly secret: string,
    private readonly repository: SessionRepository,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getSession(): Promise<AuthSession | null> {
    if (!this.token) return null;

    const now = this.now();
    const payload = verifySessionToken(this.token, this.secret, now);
    if (!payload) return null;

    const session = await this.repository.findById(payload.sessionId);
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt.getTime() <= now.getTime() ||
      session.tokenHash !== hashSessionToken(this.token)
    ) {
      return null;
    }

    return {
      sessionId: session.id,
      user: session.user,
      expiresAt: new Date(Math.min(payload.expiresAt, session.expiresAt.getTime())),
    };
  }

  async signOut(): Promise<void> {
    if (!this.token) return;

    const payload = verifySessionToken(this.token, this.secret, this.now());
    if (payload) await this.repository.revoke(payload.sessionId, this.now());
  }
}