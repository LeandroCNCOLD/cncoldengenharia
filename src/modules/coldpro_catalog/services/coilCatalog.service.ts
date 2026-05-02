export async function loadCoilGeometries() {
  const res = await fetch("/data/coils/geometries.json");
  return res.json();
}

export async function loadCorrectionCoefficients() {
  const res = await fetch("/data/coils/correction_coefficients.json");
  return res.json();
}
