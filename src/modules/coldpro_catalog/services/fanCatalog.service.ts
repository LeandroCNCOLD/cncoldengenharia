export async function loadFans(manufacturer: string, type: string): Promise<unknown> {
  const res = await fetch(`/data/fans/${manufacturer}/${type}.json`);
  if (!res.ok) throw new Error("Erro ao carregar ventiladores");
  return res.json();
}
