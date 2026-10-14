import { Outlet } from "react-router-dom";

import { ActiveOrgProvider } from "@/contexts/ActiveOrgProvider";

import { Header } from "./Header";
import { Sidebar } from "./Sidebar";

/** Shell for all signed-in pages: sidebar, header and the routed page. */
export function AppLayout() {
  return (
    <ActiveOrgProvider>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-auto p-4 md:p-6">
            <Outlet />
          </main>
        </div>
      </div>
    </ActiveOrgProvider>
  );
}
