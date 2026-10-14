import { Navigate, Outlet, useLocation } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";

import { FullPageSpinner } from "./FullPageSpinner";

/** Only renders child routes for signed-in users; everyone else goes to /login. */
export function ProtectedRoute() {
  const { session, profile, isAdmin, loading, signedOutByUser, signOut } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!session) {
    // Remember where the user wanted to go, so login can send them back —
    // unless they signed out on purpose; then the next login starts fresh.
    return (
      <Navigate to="/login" replace state={signedOutByUser ? undefined : { from: location }} />
    );
  }

  // A customer must belong to an organization to see any data.
  if (!isAdmin && !profile?.organization_id) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-4 text-center">
        <h1 className="text-xl font-semibold">Your account is not set up yet</h1>
        <p className="max-w-sm text-muted-foreground">
          Your account is not linked to an organization. Please contact your administrator.
        </p>
        <Button variant="outline" onClick={() => signOut()}>
          Sign out
        </Button>
      </div>
    );
  }

  return <Outlet />;
}
