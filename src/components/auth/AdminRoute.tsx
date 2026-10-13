import { Navigate, Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";

/**
 * Only renders child routes for admins; customers are sent to the pipeline.
 * This is a UX guard only — the real protection is Row Level Security.
 */
export function AdminRoute() {
  const { isAdmin } = useAuth();
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />;
}
