import type { Session } from "@supabase/supabase-js";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";

import { supabase } from "@/lib/supabase";

import { AuthContext, type AuthContextValue, type Profile } from "./auth-context";

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const [signedOutByUser, setSignedOutByUser] = useState(false);

  useEffect(() => {
    // Restore the session saved in localStorage (keeps the user signed in on refresh).
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });

    // Keep state in sync with sign-in, sign-out and token refresh.
    // Note: don't call other Supabase methods inside this callback — it can deadlock.
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  const profileQuery = useQuery({
    queryKey: ["profile", userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    setSignedOutByUser(false);
  }, []);

  const signOut = useCallback(async () => {
    setSignedOutByUser(true);
    await supabase.auth.signOut();
    // Drop all cached data so the next user never sees the previous user's data.
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => {
    const profile = profileQuery.data ?? null;
    return {
      session,
      user: session?.user ?? null,
      profile,
      isAdmin: profile?.role === "admin",
      loading: sessionLoading || (!!userId && profileQuery.isPending),
      signedOutByUser,
      signIn,
      signOut,
    };
  }, [
    session,
    sessionLoading,
    userId,
    profileQuery.data,
    profileQuery.isPending,
    signedOutByUser,
    signIn,
    signOut,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
