/**
 * Drawer reutilizável para funcionalidades ainda não implementadas.
 * Cumpre a regra: nenhum botão sem ação. Cada botão pendente abre este drawer
 * informando o próximo passo técnico.
 */
import { useState } from "react";
import { Wrench } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";

interface Props {
  triggerLabel: string;
  title: string;
  description: string;
  nextSteps: string[];
  variant?: "outline" | "default" | "ghost";
}

export function PendingFeatureDrawer({
  triggerLabel,
  title,
  description,
  nextSteps,
  variant = "outline",
}: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button size="sm" variant={variant}>
          <Wrench className="mr-1 h-4 w-4" />
          {triggerLabel}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-2xl">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>{description}</DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-2">
            <p className="mb-2 text-sm font-medium">Próximos passos técnicos</p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              {nextSteps.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ol>
          </div>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button variant="outline">Entendi</Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
