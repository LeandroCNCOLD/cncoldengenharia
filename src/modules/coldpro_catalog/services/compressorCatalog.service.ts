type CompressorIndex = {
  manufacturers: string[];
  files: Record<string, string[]>;
};

type CompressorCatalogRow = {
  id?: string;
  model?: string;
  refrigerant?: string;
  [key: string]: unknown;
};

const cache: Record<string, CompressorCatalogRow[]> = {};

export async function loadCompressorIndex(): Promise<CompressorIndex> {
  const res = await fetch("/data/compressors/index.json");
  if (!res.ok) throw new Error("Erro ao carregar índice de compressores");
  return res.json() as Promise<CompressorIndex>;
}

export async function loadManufacturerData(manufacturer: string): Promise<CompressorCatalogRow[]> {
  if (cache[manufacturer]) return cache[manufacturer];

  const index = await loadCompressorIndex();
  const files = index.files[manufacturer] || [];

  const results = await Promise.all(
    files.map(async (file) => {
      const res = await fetch(`/data/compressors/${file}`);
      if (!res.ok) throw new Error(`Erro ao carregar ${file}`);
      return res.json() as Promise<CompressorCatalogRow[]>;
    }),
  );

  const merged = results.flat();
  cache[manufacturer] = merged;

  return merged;
}

export async function getCompressorById(manufacturer: string, id: string) {
  const data = await loadManufacturerData(manufacturer);
  return data.find((item) => item.id === id);
}

export async function filterCompressors(manufacturer: string, search?: string) {
  const data = await loadManufacturerData(manufacturer);

  if (!search) return data;

  const s = search.toLowerCase();

  return data.filter((item) =>
    `${item.model ?? ""} ${item.refrigerant ?? ""}`.toLowerCase().includes(s),
  );
}
