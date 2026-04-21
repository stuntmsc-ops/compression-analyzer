"use client";

import { signIn, signOut, useSession } from "next-auth/react";
import Button from "./Button";

export default function AuthNav() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <span className="text-xs text-gray-500 tabular-nums px-2" aria-hidden>
        …
      </span>
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <span
          className="hidden sm:inline text-xs text-gray-400 truncate max-w-[160px]"
          title={session.user.email ?? undefined}
        >
          {session.user.email}
        </span>
        <Button variant="secondary" size="sm" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  return (
    <Button variant="secondary" size="sm" onClick={() => void signIn()}>
      Sign in
    </Button>
  );
}
