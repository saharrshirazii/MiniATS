import { LogOut, Menu } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAuth } from "@/hooks/useAuth";

import { OrgSelector } from "./OrgSelector";
import { SidebarNav } from "./Sidebar";

export function Header() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const displayName = profile?.full_name || user?.email;

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b px-4 md:px-6">
      {/* Below md, the sidebar (desktop-only) is replaced by this slide-out nav. */}
      <Sheet open={navOpen} onOpenChange={setNavOpen}>
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 md:hidden"
          aria-label="Open navigation menu"
          onClick={() => setNavOpen(true)}
        >
          <Menu />
        </Button>
        <SheetContent side="left" className="w-72 p-0">
          <SheetHeader className="h-14 justify-center border-b">
            <SheetTitle className="text-lg font-semibold tracking-tight">MiniATS</SheetTitle>
          </SheetHeader>
          <SidebarNav onNavigate={() => setNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <span className="text-lg font-semibold tracking-tight md:hidden">MiniATS</span>
      <OrgSelector />

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
