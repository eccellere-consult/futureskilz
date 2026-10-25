"use client";

import { LogOut, UserRound } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { fetchSessionUser, signOut, type SessionUser } from "@/features/learner/store";

export function AccountMenu() {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  useEffect(() => {
    let active = true;
    void fetchSessionUser().then((sessionUser) => {
      if (active) setUser(sessionUser);
    });
    return () => {
      active = false;
    };
  }, []);

  if (user === undefined) return <span aria-hidden="true" className="inline-block h-9 w-20" />;

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link className="hidden text-xs text-gold-light underline-offset-4 hover:underline md:inline" href="/join?as=coach">Become a coach</Link>
        <Link className="inline-flex min-h-9 items-center gap-2 border border-cream/25 px-3 text-xs font-medium text-cream hover:border-gold-light hover:text-gold-light" href="/join">
          <UserRound aria-hidden="true" size={15} /> Sign in
        </Link>
        <Link className="inline-flex min-h-9 items-center bg-gold px-3 text-xs font-bold text-ink hover:bg-gold-light" href="/join">
          Register
        </Link>
      </div>
    );
  }

  async function handleSignOut() {
    await signOut();
    // A full reload clears the cached session and every page's loaded profile.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/");
  }

  return (
    <div className="flex items-center gap-2">
      <Link className="text-xs font-semibold text-gold-light underline-offset-4 hover:underline" href="/learn">My learning</Link>
      {user.roles?.some((role) => ["contributor", "editor", "admin"].includes(role)) ? (
        <Link className="hidden text-xs text-gold-light underline-offset-4 hover:underline md:inline" href="/contribute/dashboard">Coach dashboard</Link>
      ) : (
        <Link className="hidden text-xs text-gold-light underline-offset-4 hover:underline md:inline" href="/contribute">Become a coach</Link>
      )}
      {user.roles?.some((role) => ["editor", "admin"].includes(role)) ? <Link className="hidden text-xs text-cream/80 underline-offset-4 hover:underline lg:inline" href="/contribute/editor">Editor desk</Link> : null}
      {user.roles?.includes("admin") ? <Link className="hidden text-xs text-cream/80 underline-offset-4 hover:underline lg:inline" href="/contribute/admin">Earnings</Link> : null}
      <span className="hidden max-w-36 truncate text-xs text-cream/70 md:inline" title={user.email}>{user.displayName}</span>
      <button
        aria-label="Sign out"
        className="inline-flex h-9 w-9 items-center justify-center border border-cream/25 text-cream hover:border-gold-light hover:text-gold-light"
        onClick={() => void handleSignOut()}
        title="Sign out"
        type="button"
      >
        <LogOut aria-hidden="true" size={15} />
      </button>
    </div>
  );
}
