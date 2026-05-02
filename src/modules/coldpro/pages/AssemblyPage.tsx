import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { PageContainer } from "../components/layout/PageContainer";
import { AssemblyForm } from "../components/assembly/AssemblyForm";
import { AssemblyPreview } from "../components/assembly/AssemblyPreview";
import { useComponentStore } from "../stores/useComponentStore";

export function AssemblyPage() {
  const [showForm, setShowForm] = useState(false);
  const assemblies = useComponentStore((s) => s.assemblies);
  const deleteAssembly = useComponentStore((s) => s.deleteAssembly);

  return (
    <PageContainer
      title="Montagem de Equipamento"
      subtitle="Associe componentes salvos para formar um sistema completo, pronto para simulação."
      actions={
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-[#1E6FD9] px-4 py-2 text-sm text-white transition-colors hover:bg-[#1558b0]"
        >
          <Plus className="h-4 w-4" />
          {showForm ? "Cancelar" : "Nova montagem"}
        </button>
      }
    >
      {showForm ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6">
          <AssemblyForm onSaved={() => setShowForm(false)} />
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            {assemblies.length} montagem
            {assemblies.length !== 1 ? "s" : ""} salva
            {assemblies.length !== 1 ? "s" : ""}
          </p>

          {assemblies.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {assemblies.map((a) => (
                <div key={a.id} className="relative">
                  <AssemblyPreview assembly={a} />
                  <button
                    type="button"
                    onClick={() => deleteAssembly(a.id)}
                    className="absolute right-3 top-3 rounded p-1 text-slate-300 hover:bg-red-50 hover:text-red-500"
                    aria-label="Excluir montagem"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white py-12 text-center">
              <p className="text-sm text-slate-500">
                Nenhuma montagem salva ainda. Comece cadastrando os componentes
                em /coldpro/components e depois monte o equipamento aqui.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-3 text-sm text-[#1E6FD9] hover:underline"
              >
                Criar a primeira montagem
              </button>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}
