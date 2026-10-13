import { LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const displayName = profile?.full_name || user?.email;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
      <span className="text-lg font-semibold tracking-tight md:hidden">MiniATS</span>
      {/* TODO(#14): admin "Acting as organization" selector */}

      <div className="ml-auto flex items-center gap-3">
        <div className="hidden text-right sm:block">
          <p className="text-sm leading-tight font-medium">{displayName}</p>
          <p className="text-xs text-muted-foreground">{isAdmin ? "Admin" : "Customer"}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          <LogOut />
          Sign out
        </Button>
      </div>
    </header>
  );
}
