import type { ReactNode } from "react";
import { useState } from "react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { SlidersHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface WorkspaceLayoutProps {
  header: ReactNode;
  sidebar: ReactNode;
  children: ReactNode;
}

/**
 * Layout padrão de workspace: header + (sidebar 320px | área de resultados).
 * Em mobile, a sidebar vira drawer acessível por um botão flutuante.
 */
export function WorkspaceLayout({ header, sidebar, children }: WorkspaceLayoutProps) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {header}
      <div className="flex flex-1 min-h-0">
        {!isMobile && (
          <aside className="w-[320px] shrink-0 overflow-y-auto border-r border-border bg-card">
            {sidebar}
          </aside>
        )}
        <main className="flex-1 min-w-0 overflow-x-hidden bg-background">
          {children}
        </main>
      </div>
      {isMobile && (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button
              size="icon"
              className="fixed bottom-4 right-4 z-30 h-12 w-12 rounded-full shadow-lg"
              aria-label="Abrir parâmetros"
            >
              <SlidersHorizontal className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="h-[85vh] overflow-y-auto p-0">
            {sidebar}
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
