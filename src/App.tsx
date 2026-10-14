import { Route, Routes } from "react-router-dom";

import { AdminRoute } from "@/components/auth/AdminRoute";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppLayout } from "@/components/layout/AppLayout";
import { ActivityLogPage } from "@/pages/ActivityLogPage";
import { CandidatesPage } from "@/pages/CandidatesPage";
import { JobsPage } from "@/pages/JobsPage";
import { KanbanPage } from "@/pages/KanbanPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OrganizationsPage } from "@/pages/admin/OrganizationsPage";
import { UsersPage } from "@/pages/admin/UsersPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      {/* Signed-in users only */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<KanbanPage />} />
          <Route path="jobs" element={<JobsPage />} />
          <Route path="candidates" element={<CandidatesPage />} />
          <Route path="activity" element={<ActivityLogPage />} />

          {/* Admins only */}
          <Route path="admin" element={<AdminRoute />}>
            <Route path="organizations" element={<OrganizationsPage />} />
            <Route path="users" element={<UsersPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
