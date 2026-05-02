import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/dashboard")({
  component: () => <Navigate to="/coldpro" replace />,
});
