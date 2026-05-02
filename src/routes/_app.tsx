import { createFileRoute, Outlet, Navigate, useRouterState } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_app")({
  component: AppLayout,
});

function AppLayout() {
  const { user, loading } = useAuth();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  // ColdPro module renders its own full-screen shell (sidebar + topbar).
  // Skip the global app chrome to avoid duplicated sidebars.
  const isColdPro = pathname === "/coldpro" || pathname.startsWith("/coldpro/");
  if (isColdPro) {
    return <Outlet />;
  }

  return (
    <div className="flex min-h-screen w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-7xl p-6 lg:p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
