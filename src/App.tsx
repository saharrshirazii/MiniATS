import { Route, Routes } from "react-router-dom";

import { AppLayout } from "@/components/layout/AppLayout";
import { CandidatesPage } from "@/pages/CandidatesPage";
import { JobsPage } from "@/pages/JobsPage";
import { KanbanPage } from "@/pages/KanbanPage";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { OrganizationsPage } from "@/pages/admin/OrganizationsPage";
import { UsersPage } from "@/pages/admin/UsersPage";

// Route protection (signed-in / admin only) is added in #8.
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route element={<AppLayout />}>
        <Route index element={<KanbanPage />} />
        <Route path="jobs" element={<JobsPage />} />
        <Route path="candidates" element={<CandidatesPage />} />
        <Route path="admin/organizations" element={<OrganizationsPage />} />
        <Route path="admin/users" element={<UsersPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
