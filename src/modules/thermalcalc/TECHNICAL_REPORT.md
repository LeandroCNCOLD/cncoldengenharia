# ThermalCalc technical report

## Formulas implemented

- Internal diameter: `innerDiameter = outerDiameter - 2 * wallThickness`.
- Total tube length: `totalTubeLength = activeTubeCount * usefulTubeLength`.
- Internal tube area: `internalArea = PI * innerDiameter * totalTubeLength`.
- Internal volume: `internalVolume = PI * (innerDiameter^2 / 4) * totalTubeLength`.
- Estimated refrigerant mass: `mass = internalVolume * averageDensity * fillFactor`.
- Approximate external tube area: `externalTubeArea = PI * outerDiameter * totalTubeLength`.
- Approximate fin area: `externalFinArea = 2 * finCount * max(finHeight * finDepth - tubeHoleArea, 0)`.
- Estimated heat capacity: `capacity = U * externalArea * abs(airInletTemperature - refrigerantTemperature)`.

## Files created

- `src/modules/thermalcalc/types/index.ts`
- `src/modules/thermalcalc/data/refrigerants.ts`
- `src/modules/thermalcalc/engines/units.ts`
- `src/modules/thermalcalc/engines/geometry/coilGeometry.ts`
- `src/modules/thermalcalc/engines/refrigerants/charge.ts`
- `src/modules/thermalcalc/engines/heatTransfer/heatTransfer.ts`
- `src/modules/thermalcalc/engines/validation/geometryValidation.ts`
- `src/modules/thermalcalc/engines/adapters/coldpro.ts`
- `src/modules/thermalcalc/engines/index.ts`
- `src/modules/thermalcalc/index.ts`
- `src/modules/thermalcalc/tests/thermalcalc.test.ts`

## Pending validations

- Confirm CN COLD standard tube diameters and wall thicknesses for each commercial family.
- Replace initial refrigerant density table with certified property data over operating temperature ranges.
- Calibrate fill factors by coil family, circuiting pattern, headers, distributor volume, and application.
- Validate external fin area approximations against CAD/Unilab geometry references.
- Add pressure-drop and two-phase heat-transfer correlations before using capacity estimates as final selection data.

## Technical limitations

- Current capacity calculation is a first-order `U * A * deltaT` estimate, not a full evaporator/condenser rating model.
- External area uses a simplified fin plate approximation and does not model corrugation, louver geometry, contact resistance, or fin efficiency.
- Refrigerant charge currently covers the finned core volume only; headers, distributors, liquid line volume, and oil effects are not included.
- Density interpolation uses the initial reference table and nearest-point fallback when temperature is outside the table.
- Validation catches dimensional inconsistencies but does not yet enforce every manufacturing constraint.
