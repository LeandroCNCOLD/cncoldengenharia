# ThermalCalc technical report

## Formulas implemented

- Internal diameter: `innerDiameter = outerDiameter - 2 * wallThickness`.
- Total tube length: `totalTubeLength = activeTubeCount * usefulTubeLength`.
- Internal tube area: `internalArea = PI * innerDiameter * totalTubeLength`.
- Internal volume: `internalVolume = PI * (innerDiameter^2 / 4) * totalTubeLength`.
- Estimated refrigerant mass: `mass = internalVolume * averageDensity * fillFactor`.
- Approximate external tube area: `externalTubeArea = PI * outerDiameter * totalTubeLength`.
- Real fin area: `externalFinArea = 2 * finCount * max(finHeight * finDepth - tubeHoleArea, 0)`.
- Fin efficiency: `etaFin = tanh(m * L) / (m * L)`, with `m = sqrt(2 * hAir / (kFin * finThickness))`.
- Effective area: `Aeff = externalTubeArea + externalFinArea * etaFin`.
- Air-side coefficient: Colburn `j` correlations for Chang-Wang louver, Wang-Herringbone wavy, and plain fallback.
- Refrigerant-side coefficient: Dittus-Boelter, Gnielinski, simplified Shah evaporation, and base condensation.
- Global coefficient: `U = 1 / (1 / hAir + Rwall + Rfouling + 1 / hRefrigerant)`.
- Heat capacity: `Q = U * Aeff * DTML`.
- Pressure drop: Darcy/Colburn structured estimates for air side and refrigerant side.

## Files created

- `src/modules/thermalcalc/types/index.ts`
- `src/modules/thermalcalc/data/refrigerants.ts`
- `src/modules/thermalcalc/engines/units.ts`
- `src/modules/thermalcalc/engines/geometry/coilGeometry.ts`
- `src/modules/thermalcalc/engines/geometry/effectiveArea.ts`
- `src/modules/thermalcalc/engines/refrigerants/charge.ts`
- `src/modules/thermalcalc/engines/heatTransfer/airSide.ts`
- `src/modules/thermalcalc/engines/heatTransfer/refrigerantSide.ts`
- `src/modules/thermalcalc/engines/heatTransfer/heatTransfer.ts`
- `src/modules/thermalcalc/engines/validation/geometryValidation.ts`
- `src/modules/thermalcalc/engines/adapters/coldpro.ts`
- `src/modules/thermalcalc/engines/index.ts`
- `src/modules/thermalcalc/index.ts`
- `src/modules/thermalcalc/tests/thermalcalc.test.ts`

## Pending validations

- Confirm CN COLD standard tube diameters and wall thicknesses for each commercial family.
- Replace seed refrigerant property tables with certified REFPROP/CoolProp-derived property grids before warranty use.
- Calibrate air-side j/f multipliers by CN COLD fin family and wind-tunnel or Unilab references.
- Calibrate fill factors by coil family, circuiting pattern, headers, distributor volume, and application.
- Validate external fin area and free-flow area against CAD/Unilab geometry references.
- Validate pressure-drop multipliers against lab data for louver, wavy, and plain fin families.

## Technical limitations

- Capacity now uses `U * Aeff * DTML`, but air/refrigerant correlations still need empirical multipliers per manufacturing family.
- External area models fin plate area and fin efficiency, but louver/corrugation geometry is represented through correlations rather than CAD-resolved surface area.
- Refrigerant charge currently covers the finned core volume only; headers, distributors, liquid line volume, and oil effects are not included.
- Refrigerant properties are deterministic seed tables with interpolation; they are not a substitute for certified property libraries.
- Validation catches dimensional inconsistencies but does not yet encode every CN COLD manufacturing rule.
