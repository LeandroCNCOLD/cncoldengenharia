import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface PlaceholderAreaProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function PlaceholderArea({ icon: Icon, title, description }: PlaceholderAreaProps) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <div className="rounded-full bg-primary/10 p-4">
          <Icon className="h-8 w-8 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="font-display text-xl font-semibold">{title}</h2>
          <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full bg-warning/15 px-3 py-1 text-xs font-medium text-warning-foreground">
          Disponível na próxima etapa
        </span>
      </CardContent>
    </Card>
  );
}
