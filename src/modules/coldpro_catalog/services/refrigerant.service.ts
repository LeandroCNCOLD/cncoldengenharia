export async function loadRefrigerants(): Promise<unknown> {
  const res = await fetch("/data/refrigerants/pure.json");
  if (!res.ok) throw new Error("Erro ao carregar refrigerantes");
  return res.json();
}
