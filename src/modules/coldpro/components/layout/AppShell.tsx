import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AIAssistantPanel } from "../ai/AIAssistantPanel";

export function AppShell() {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F4F6F9]">
      <Sidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onToggleAI={() => setIsAIPanelOpen((v) => !v)} />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {isAIPanelOpen && <AIAssistantPanel onClose={() => setIsAIPanelOpen(false)} />}
    </div>
  );
}
