import { useMemo } from "react";

export interface ColdRoomInputs {
  width_m: number;
  depth_m: number;
  height_m: number;
  wallInsulation_mm: number;
  roofInsulation_mm: number;
  floorInsulation_mm: number;
  insulationK: number;
  Tamb_C: number;
  Troom_C: number;
  safetyFactor: number;
  lightingPower_W: number;
  motorPower_W: number;
  peopleCount: number;
  openingTime_h: number;
  productMass_kg: number;
  productCp: number;
  productTin_C: number;
}

export interface ColdRoomLoadResult {
  Q_transmission_W: number;
  Q_infiltration_W: number;
  Q_lighting_W: number;
  Q_motor_W: number;
  Q_people_W: number;
  Q_product_W: number;
  Q_total_W: number;
  breakdown: Array<{ name: string; value: number; percentage: number }>;
}

export const DEFAULT_COLD_ROOM_INPUTS: ColdRoomInputs = {
  width_m: 4,
  depth_m: 6,
  height_m: 3,
  wallInsulation_mm: 100,
  roofInsulation_mm: 150,
  floorInsulation_mm: 100,
  insulationK: 0.04,
  Tamb_C: 35,
  Troom_C: -18,
  safetyFactor: 1.15,
  lightingPower_W: 200,
  motorPower_W: 0,
  peopleCount: 0,
  openingTime_h: 0.5,
  productMass_kg: 500,
  productCp: 3.5,
  productTin_C: 20,
};

export function calculateColdRoomLoad(inputs: ColdRoomInputs): ColdRoomLoadResult {
  const A_walls = 2 * (inputs.width_m * inputs.height_m + inputs.depth_m * inputs.height_m);
  const A_roof = inputs.width_m * inputs.depth_m;
  const A_floor = A_roof;
  const U_wall = inputs.insulationK / Math.max(inputs.wallInsulation_mm / 1000, 0.001);
  const U_roof = inputs.insulationK / Math.max(inputs.roofInsulation_mm / 1000, 0.001);
  const U_floor = inputs.insulationK / Math.max(inputs.floorInsulation_mm / 1000, 0.001);
  const DT = inputs.Tamb_C - inputs.Troom_C;
  const Q_transmission_W = (U_wall * A_walls + U_roof * A_roof + U_floor * A_floor) * DT;
  const Q_infiltration_W = 0.3 * Q_transmission_W * (inputs.openingTime_h / 24);
  const Q_lighting_W = inputs.lightingPower_W;
  const Q_motor_W = inputs.motorPower_W;
  const Q_people_W = inputs.peopleCount * 270;
  const Q_product_W =
    (inputs.productMass_kg * inputs.productCp * 1000 * Math.max(0, inputs.productTin_C - inputs.Troom_C)) /
    (16 * 3600);
  const subtotal =
    Q_transmission_W + Q_infiltration_W + Q_lighting_W + Q_motor_W + Q_people_W + Q_product_W;
  const Q_total_W = subtotal * inputs.safetyFactor;
  const items = [
    { name: "Transmissão", value: Q_transmission_W },
    { name: "Infiltração", value: Q_infiltration_W },
    { name: "Iluminação", value: Q_lighting_W },
    { name: "Motores", value: Q_motor_W },
    { name: "Pessoas", value: Q_people_W },
    { name: "Produto", value: Q_product_W },
  ];
  return {
    Q_transmission_W,
    Q_infiltration_W,
    Q_lighting_W,
    Q_motor_W,
    Q_people_W,
    Q_product_W,
    Q_total_W,
    breakdown: items.map((item) => ({
      ...item,
      percentage: subtotal > 0 ? (item.value / subtotal) * 100 : 0,
    })),
  };
}

export function useColdRoomLoad(inputs: ColdRoomInputs) {
  return useMemo(() => calculateColdRoomLoad(inputs), [inputs]);
}
