/**
 * ManualCoilDesignForm
 *
 * Atalho semântico para o formulário rico de aletado manual.
 *
 * O formulário completo (geometria, tubos, aletas, ar, refrigerante,
 * resultados, debug técnico) vive em
 *   src/routes/_app/coldpro/equipamentos/$id/coil-simulator.tsx
 * (CoilSimulatorPage) — junto com a integração thermalcalc, biblioteca,
 * "Salvar como componente" e mapa de desempenho.
 *
 * Esta camada existe para preservar o ponto de entrada
 * `@/components/coldpro/coil/manual-coil-design-form` referenciado em
 * outras telas do ColdPro: ela renderiza um botão de navegação para
 * abrir o workspace do Coil Simulator no equipamento atual.
 *
 * Para abrir já com geometria pré-carregada de um componente da
 * Biblioteca, use a seção "Dimensionamento Manual de Aletado" em
 * `src/components/coldpro/sizing-tab.tsx` (grava prefill em localStorage
 * antes de navegar).
 */
import { Link } from "@tanstack/react-router";
import { Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface ManualCoilDesignFormProps {
  equipmentProjectId: string;
  variant?: "button" | "compact";
  label?: string;
}

export function ManualCoilDesignForm({
  equipmentProjectId,
  variant = "button",
  label = "Abrir dimensionamento manual",
}: ManualCoilDesignFormProps) {
  return (
    <Button asChild variant={variant === "compact" ? "outline" : "default"} size={variant === "compact" ? "sm" : "default"}>
      <Link
        to="/coldpro/equipamentos/$id/coil-simulator"
        params={{ id: equipmentProjectId }}
      >
        <Wand2 className="mr-1 h-4 w-4" />
        {label}
      </Link>
    </Button>
  );
}

export default ManualCoilDesignForm;
