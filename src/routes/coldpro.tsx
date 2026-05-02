import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { AppShell } from "@/modules/coldpro/components/layout/AppShell";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/coldpro")({
  component: ColdProLayout,
});

function ColdProLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F4F6F9]">
        <Loader2 className="h-6 w-6 animate-spin text-[#1E6FD9]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" />;
  }

  return <AppShell />;
}
