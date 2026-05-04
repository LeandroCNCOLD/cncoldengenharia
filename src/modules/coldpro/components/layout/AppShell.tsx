import { Outlet } from "@tanstack/react-router";
import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { AIAssistantPanel } from "../ai/AIAssistantPanel";
import { Sheet, SheetContent } from "@/components/ui/sheet";

export function AppShell() {
  const [isAIPanelOpen, setIsAIPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#F4F6F9]">
      {/* Desktop sidebar — always visible on lg+ */}
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      {/* Mobile sidebar — Sheet drawer from left */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-56 p-0 [&>button]:hidden">
          <Sidebar onClose={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          onToggleAI={() => setIsAIPanelOpen((v) => !v)}
          onToggleSidebar={() => setSidebarOpen((v) => !v)}
        />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>

      {isAIPanelOpen && <AIAssistantPanel onClose={() => setIsAIPanelOpen(false)} />}
    </div>
  );
}
