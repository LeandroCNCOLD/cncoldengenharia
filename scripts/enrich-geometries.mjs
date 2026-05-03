import { readFileSync, writeFileSync } from "fs";

const coilPath = "public/data/catalogs/coilGeometries.json";
const legacyPath = "public/data/catalogs/geometries.json";

const coilGeos = JSON.parse(readFileSync(coilPath, "utf-8"));
const legacyGeos = JSON.parse(readFileSync(legacyPath, "utf-8"));

const legacyByCode = new Map();
for (const g of legacyGeos) {
  if (g.Sigla) legacyByCode.set(g.Sigla, g);
}

let enriched = 0;
for (const item of coilGeos) {
  const code = item.raw?.code;
  if (!code) continue;
  const legacy = legacyByCode.get(code);
  if (!legacy) continue;
  item.raw.FatCorAl = legacy.FatCorAl ?? null;
  item.raw.FattoreAttrAria = legacy.FattoreAttrAria ?? null;
  item.raw.RappSuperficiInterne = legacy.RappSuperficiInterne ?? null;
  item.raw.SecurityFactor = legacy.SecurityFactor ?? 1.0;
  item.raw.TipoAletta = legacy.TipoAletta ?? null;
  enriched++;
}

writeFileSync(coilPath, JSON.stringify(coilGeos, null, 2));
console.log(`Enriquecidas ${enriched} de ${coilGeos.length} geometrias.`);
