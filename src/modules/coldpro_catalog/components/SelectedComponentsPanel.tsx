import type { CatalogEquipmentRow } from "../data/equipmentCatalog.types";

interface ItemProps {
  label: string;
  item?: CatalogEquipmentRow;
}

function SelectedItem({ label, item }: ItemProps) {
  return (
    <div className="rounded-md border border-gray-200 p-3">
      <p className="text-xs uppercase tracking-wider text-gray-500">{label}</p>
      {item ? (
        <>
          <p className="mt-1 font-medium text-gray-900">
            {item.modeloBaseReferencia ?? item.modelo}
          </p>
          <p className="text-xs text-gray-600">
            {item.refrigerante} · {item.tensaoV ?? "—"}V · {item.numeroFases ?? "—"}F
          </p>
          {item.capacidadeFrigorificaKcalH && (
            <p className="text-xs text-gray-600">
              {item.capacidadeFrigorificaKcalH.toLocaleString("pt-BR")} kcal/h
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-gray-400">Não selecionado</p>
      )}
    </div>
  );
}

interface Props {
  selectedCompressor?: CatalogEquipmentRow;
  selectedCondenser?: CatalogEquipmentRow;
  onClear: () => void;
  onProceed?: () => void;
}

export function SelectedComponentsPanel({
  selectedCompressor,
  selectedCondenser,
  onClear,
  onProceed,
}: Props) {
  const hasAny = !!(selectedCompressor || selectedCondenser);

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">Seleção atual</h3>
        {hasAny && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Limpar
          </button>
        )}
      </div>

      <SelectedItem label="Compressor / Unidade" item={selectedCompressor} />
      <SelectedItem label="Condensador / Unidade" item={selectedCondenser} />

      {onProceed && (
        <button
          type="button"
          onClick={onProceed}
          disabled={!hasAny}
          className="w-full rounded-md bg-[#1E6FD9] px-4 py-2 text-sm font-medium text-white hover:bg-[#1859B0] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Usar na simulação →
        </button>
      )}

      {!hasAny && (
        <p className="text-xs text-gray-500">
          Selecione ao menos um equipamento da tabela.
        </p>
      )}
    </div>
  );
}
