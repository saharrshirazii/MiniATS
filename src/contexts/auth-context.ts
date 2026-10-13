import type { Session, User } from "@supabase/supabase-js";
import { createContext } from "react";

import type { Tables } from "@/types/database.types";

export type Profile = Tables<"profiles">;

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** Row from public.profiles (role, organization). null while loading or signed out. */
  profile: Profile | null;
  isAdmin: boolean;
  /** True until the initial session and profile have been resolved. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
