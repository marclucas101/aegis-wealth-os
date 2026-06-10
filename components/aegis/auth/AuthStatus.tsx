"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  if (!local) return "—";
  return local.slice(0, 2).toUpperCase();
}

export default function AuthStatus() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    try {
      const supabase = createBrowserSupabaseClient();

      void supabase.auth.getUser().then(({ data: { user: currentUser } }) => {
        if (!active) return;
        setUser(currentUser);
        setLoading(false);
      });

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        if (!active) return;
        setUser(session?.user ?? null);
        setLoading(false);
      });

      return () => {
        active = false;
        subscription.unsubscribe();
      };
    } catch {
      queueMicrotask(() => {
        if (active) {
          setLoading(false);
        }
      });
      return undefined;
    }
  }, []);

  if (loading) {
    return (
      <div className="flex h-8 w-8 items-center justify-center rounded-sm border border-[#D1A866]/10 bg-[#10283A]/30">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#D1A866]/40" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  const email = user.email ?? "Signed in";

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      <div className="hidden min-w-0 sm:block">
        <p className="truncate text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/35">
          Signed in
        </p>
        <p className="max-w-[10rem] truncate text-xs text-[#F3F1EA]/70 lg:max-w-[14rem]">
          {email}
        </p>
      </div>

      <div
        className="flex h-8 w-8 items-center justify-center rounded-sm border border-[#D1A866]/15 bg-[#10283A]/50"
        title={email}
      >
        <span className="text-[10px] font-medium uppercase tracking-wider text-[#D1A866]/70">
          {initialsFromEmail(email)}
        </span>
      </div>

      <Link
        href="/logout"
        className="rounded-sm border border-[#D1A866]/15 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.12em] text-[#F3F1EA]/45 transition-colors hover:border-[#D1A866]/30 hover:text-[#D1A866]/80"
      >
        Sign out
      </Link>
    </div>
  );
}
