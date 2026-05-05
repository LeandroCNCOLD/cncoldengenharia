// Catálogo de Ventiladores Ziehl-Abegg
// Gerado automaticamente a partir dos datasheets oficiais
// Data: 2025-05-05

export interface FanCurvePoint {
  q_m3h: number;      // Vazão em m³/h
  psf_pa: number;     // Pressão estática em Pa
  p1_w?: number;      // Potência elétrica em W
}

export interface FanModel {
  model: string;           // Type key (ex: FN056-4DK.4M.V7P2)
  article_number: string;  // Número de artigo Ziehl-Abegg
  manufacturer: string;    // Fabricante
  diameter_mm: number;     // Diâmetro em mm
  electrical_nominal: string; // Dados elétricos nominais
  rpm_nominal: number;     // RPM nominal
  sound_lwa_db: number;    // Nível de potência sonora LwA [dB(A)]
  erp_efficiency_pct: number; // Eficiência estática ErP [%]
  q_max_m3h: number;       // Vazão máxima (pressão zero)
  dp_max_pa: number;       // Pressão máxima (vazão zero)
  p1_nominal_w: number;    // Potência nominal [W]
  curve_points: FanCurvePoint[]; // Pontos da curva Q×ΔP
}

export const FAN_CATALOG: FanModel[] = [
  {
    "model": "FN056-4DK.4M.V7P2",
    "article_number": "162306",
    "manufacturer": "Ziehl-Abegg",
    "diameter_mm": 560,
    "electrical_nominal": "3~ 230/400V ±10% D/Y 50Hz, P1 1.05kW, 3.8/2.2A, 1280rpm",
    "rpm_nominal": 1280,
    "sound_lwa_db": 81.5,
    "erp_efficiency_pct": 33.7,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 200.0,
        "p1_w": 600.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 195.0,
        "p1_w": 620.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 185.0,
        "p1_w": 650.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 170.0,
        "p1_w": 680.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 150.0,
        "p1_w": 720.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 125.0,
        "p1_w": 760.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 95.0,
        "p1_w": 800.0
      },
      {
        "q_m3h": 7000.0,
        "psf_pa": 60.0,
        "p1_w": 850.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 20.0,
        "p1_w": 900.0
      },
      {
        "q_m3h": 8500.0,
        "psf_pa": 0.0,
        "p1_w": 920.0
      }
    ],
    "num_curve_points": 10,
    "has_valid_curve": true,
    "q_max_m3h": 8500.0,
    "dp_max_pa": 200.0,
    "p1_nominal_w": 920.0
  },
  {
    "model": "FN035-4DK.0F.V7P2",
    "article_number": "157229",
    "manufacturer": "Ziehl-Abegg",
    "diameter_mm": 350,
    "electrical_nominal": "3~230/400V±10% D/Y 50Hz P1 190W 0,69/0,40A ΔI=0% 1390/min COSY 0,69 70°C",
    "rpm_nominal": 1390,
    "sound_lwa_db": 84.0,
    "erp_efficiency_pct": 29.3,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 240.0,
        "p1_w": 210.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 210.0,
        "p1_w": 190.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 170.0,
        "p1_w": 170.0
      },
      {
        "q_m3h": 1500.0,
        "psf_pa": 125.0,
        "p1_w": 150.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 80.0,
        "p1_w": 130.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 40.0,
        "p1_w": 110.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 10.0,
        "p1_w": 90.0
      },
      {
        "q_m3h": 3200.0,
        "psf_pa": 0.0,
        "p1_w": 80.0
      }
    ],
    "num_curve_points": 8,
    "has_valid_curve": true,
    "q_max_m3h": 3200.0,
    "dp_max_pa": 240.0,
    "p1_nominal_w": 210.0
  },
  {
    "model": "FN035-4EK.0F.V7P2",
    "article_number": "155883",
    "manufacturer": "Ziehl-Abegg",
    "diameter_mm": 350,
    "electrical_nominal": "1~230V, 1 fase, 50Hz, P1 0.23kW, 1.05A, 1410 RPM",
    "rpm_nominal": 1410,
    "sound_lwa_db": 72.0,
    "erp_efficiency_pct": 25.8,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 162.0,
        "p1_w": 120.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 155.0,
        "p1_w": 125.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 140.0,
        "p1_w": 135.0
      },
      {
        "q_m3h": 1500.0,
        "psf_pa": 115.0,
        "p1_w": 150.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 85.0,
        "p1_w": 170.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 50.0,
        "p1_w": 190.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 20.0,
        "p1_w": 210.0
      },
      {
        "q_m3h": 3200.0,
        "psf_pa": 0.0,
        "p1_w": 220.0
      }
    ],
    "num_curve_points": 8,
    "has_valid_curve": true,
    "q_max_m3h": 3200.0,
    "dp_max_pa": 162.0,
    "p1_nominal_w": 220.0
  },
  {
    "model": "FN040-4DK.0F.V7P1",
    "article_number": "157237",
    "manufacturer": "Ziehl-Abegg",
    "diameter_mm": 400,
    "electrical_nominal": "3~230/400V±10% D/Y 50Hz P1 230W, 0,80/0,46A, 1360 RPM",
    "rpm_nominal": 1360,
    "sound_lwa_db": 60.0,
    "erp_efficiency_pct": 33.2,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 160.0,
        "p1_w": 100.0
      },
      {
        "q_m3h": 250.0,
        "psf_pa": 155.0,
        "p1_w": 102.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 150.0,
        "p1_w": 105.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 130.0,
        "p1_w": 115.0
      },
      {
        "q_m3h": 1500.0,
        "psf_pa": 100.0,
        "p1_w": 130.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 60.0,
        "p1_w": 160.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 20.0,
        "p1_w": 200.0
      },
      {
        "q_m3h": 2700.0,
        "psf_pa": 0.0,
        "p1_w": 220.0
      }
    ],
    "num_curve_points": 8,
    "has_valid_curve": true,
    "q_max_m3h": 2700.0,
    "dp_max_pa": 160.0,
    "p1_nominal_w": 220.0
  },
  {
    "model": "FN040-4EK.2F.V7P1",
    "article_number": "154300",
    "manufacturer": "Ziehl-Abegg",
    "diameter_mm": 400,
    "electrical_nominal": "1~ 230V 50Hz P1 0.28kW 1.80A 1380RPM",
    "rpm_nominal": 1380,
    "sound_lwa_db": 70.5,
    "erp_efficiency_pct": 36.6,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 150.0,
        "p1_w": null
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 140.0,
        "p1_w": 50.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 120.0,
        "p1_w": 100.0
      },
      {
        "q_m3h": 1500.0,
        "psf_pa": 90.0,
        "p1_w": 150.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 50.0,
        "p1_w": 200.0
      },
      {
        "q_m3h": 2250.0,
        "psf_pa": 30.0,
        "p1_w": 215.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 10.0,
        "p1_w": 230.0
      },
      {
        "q_m3h": 2700.0,
        "psf_pa": 0.0,
        "p1_w": 240.0
      }
    ],
    "num_curve_points": 8,
    "has_valid_curve": true,
    "q_max_m3h": 2700.0,
    "dp_max_pa": 150.0,
    "p1_nominal_w": 240.0
  },
  {
    "model": "FN045-4DQ.4I.V7P1",
    "article_number": "160983",
    "manufacturer": "Ziehl-Abegg",
    "diameter_mm": 450,
    "electrical_nominal": "3~230/400V D/Y 50Hz P(1) 0.52kW, 2.1/1.2A ΔI=0% 1320/min COSY 0,62 80°C",
    "rpm_nominal": 1320,
    "sound_lwa_db": 72.0,
    "erp_efficiency_pct": 32.9,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 98.0,
        "p1_w": 200.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 95.0,
        "p1_w": 220.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 90.0,
        "p1_w": 250.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 75.0,
        "p1_w": 300.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 55.0,
        "p1_w": 380.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 30.0,
        "p1_w": 450.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 5.0,
        "p1_w": 490.0
      },
      {
        "q_m3h": 5500.0,
        "psf_pa": 0.0,
        "p1_w": 500.0
      }
    ],
    "num_curve_points": 8,
    "has_valid_curve": true,
    "q_max_m3h": 5500.0,
    "dp_max_pa": 98.0,
    "p1_nominal_w": 500.0
  },
  {
    "model": "FN050-4DK.4I.V7P1",
    "article_number": "156754",
    "manufacturer": "Ziehl-Abegg",
    "diameter_mm": 500,
    "electrical_nominal": "3-230/400V, 50Hz, P1 0,77kW, 2,95/1,7A, 1300 RPM",
    "rpm_nominal": 1300,
    "sound_lwa_db": 74.0,
    "erp_efficiency_pct": 39.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 160.0,
        "p1_w": 450.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 155.0,
        "p1_w": 470.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 145.0,
        "p1_w": 500.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 130.0,
        "p1_w": 550.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 110.0,
        "p1_w": 600.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 85.0,
        "p1_w": 650.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 55.0,
        "p1_w": 700.0
      },
      {
        "q_m3h": 7000.0,
        "psf_pa": 20.0,
        "p1_w": 750.0
      },
      {
        "q_m3h": 7500.0,
        "psf_pa": 0.0,
        "p1_w": 770.0
      }
    ],
    "num_curve_points": 9,
    "has_valid_curve": true,
    "q_max_m3h": 7500.0,
    "dp_max_pa": 160.0,
    "p1_nominal_w": 770.0
  },
  {
    "model": "FN063-4DK.6N.V7P6",
    "article_number": "165630",
    "manufacturer": "Ziehl-Abegg",
    "diameter_mm": 630,
    "electrical_nominal": "3~ 400V 50Hz P1 1,75kW 3,7A 1400 RPM",
    "rpm_nominal": 1400,
    "sound_lwa_db": 89.0,
    "erp_efficiency_pct": 33.7,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 255.0,
        "p1_w": 1300.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 245.0,
        "p1_w": 1350.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 230.0,
        "p1_w": 1400.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 205.0,
        "p1_w": 1450.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 170.0,
        "p1_w": 1500.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 125.0,
        "p1_w": 1550.0
      },
      {
        "q_m3h": 12000.0,
        "psf_pa": 70.0,
        "p1_w": 1600.0
      },
      {
        "q_m3h": 14000.0,
        "psf_pa": 10.0,
        "p1_w": 1650.0
      }
    ],
    "num_curve_points": 8,
    "has_valid_curve": true,
    "q_max_m3h": 14000.0,
    "dp_max_pa": 255.0,
    "p1_nominal_w": 1650.0
  },
  {
    "model": "FN080-6DQ.6N.V7",
    "article_number": "155610",
    "manufacturer": "Ziehl-Abegg",
    "diameter_mm": 800,
    "electrical_nominal": "3~230/400V, 50Hz, 1.60kW, 6.20/3.60A, 870 RPM",
    "rpm_nominal": 870,
    "sound_lwa_db": 76.0,
    "erp_efficiency_pct": 36.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 330.0,
        "p1_w": 200.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 300.0,
        "p1_w": 500.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 270.0,
        "p1_w": 800.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 230.0,
        "p1_w": 1100.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 190.0,
        "p1_w": 1400.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 140.0,
        "p1_w": 1600.0
      },
      {
        "q_m3h": 12000.0,
        "psf_pa": 90.0,
        "p1_w": 1800.0
      },
      {
        "q_m3h": 14000.0,
        "psf_pa": 40.0,
        "p1_w": 1900.0
      },
      {
        "q_m3h": 15000.0,
        "psf_pa": 0.0,
        "p1_w": 1950.0
      }
    ],
    "num_curve_points": 9,
    "has_valid_curve": true,
    "q_max_m3h": 15000.0,
    "dp_max_pa": 330.0,
    "p1_nominal_w": 1950.0
  }
];

/**
 * Interpola a pressão estática para uma dada vazão usando a curva do ventilador.
 * Usa interpolação linear entre os pontos mais próximos.
 */
export function interpolatePressure(fan: FanModel, q_m3h: number): number {
  const pts = fan.curve_points;
  if (!pts || pts.length < 2) return 0;
  
  // Fora do range
  if (q_m3h <= pts[0].q_m3h) return pts[0].psf_pa;
  if (q_m3h >= pts[pts.length - 1].q_m3h) return 0;
  
  // Encontrar intervalo
  for (let i = 0; i < pts.length - 1; i++) {
    if (q_m3h >= pts[i].q_m3h && q_m3h <= pts[i + 1].q_m3h) {
      const t = (q_m3h - pts[i].q_m3h) / (pts[i + 1].q_m3h - pts[i].q_m3h);
      return pts[i].psf_pa + t * (pts[i + 1].psf_pa - pts[i].psf_pa);
    }
  }
  return 0;
}

/**
 * Interpola a potência para uma dada vazão usando a curva do ventilador.
 */
export function interpolatePower(fan: FanModel, q_m3h: number): number {
  const pts = fan.curve_points.filter(p => p.p1_w !== undefined && p.p1_w !== null);
  if (!pts || pts.length < 2) return fan.p1_nominal_w;
  
  if (q_m3h <= pts[0].q_m3h) return pts[0].p1_w!;
  if (q_m3h >= pts[pts.length - 1].q_m3h) return pts[pts.length - 1].p1_w!;
  
  for (let i = 0; i < pts.length - 1; i++) {
    if (q_m3h >= pts[i].q_m3h && q_m3h <= pts[i + 1].q_m3h) {
      const t = (q_m3h - pts[i].q_m3h) / (pts[i + 1].q_m3h - pts[i].q_m3h);
      return pts[i].p1_w! + t * (pts[i + 1].p1_w! - pts[i].p1_w!);
    }
  }
  return fan.p1_nominal_w;
}

/**
 * Encontra o ponto de operação do ventilador dado a resistência do sistema (curva de sistema).
 * A curva de sistema é definida por: ΔP_sistema = R × Q²
 * onde R é calculado a partir de um ponto de operação conhecido.
 */
export function findOperatingPoint(
  fan: FanModel,
  systemResistance: number // R = ΔP / Q² [Pa/(m³/h)²]
): { q_m3h: number; psf_pa: number; p1_w: number } | null {
  const pts = fan.curve_points;
  if (!pts || pts.length < 2) return null;
  
  // Encontrar interseção: curva do ventilador vs curva do sistema
  for (let i = 0; i < pts.length - 1; i++) {
    const q1 = pts[i].q_m3h;
    const q2 = pts[i + 1].q_m3h;
    const dp_fan1 = pts[i].psf_pa;
    const dp_fan2 = pts[i + 1].psf_pa;
    const dp_sys1 = systemResistance * q1 * q1;
    const dp_sys2 = systemResistance * q2 * q2;
    
    // Verificar cruzamento
    if ((dp_fan1 - dp_sys1) * (dp_fan2 - dp_sys2) <= 0) {
      // Interpolação linear para encontrar o ponto exato
      const dFan = dp_fan2 - dp_fan1;
      const dSys = dp_sys2 - dp_sys1;
      const t = (dp_fan1 - dp_sys1) / (dSys - dFan);
      const q_op = q1 + t * (q2 - q1);
      const dp_op = dp_fan1 + t * (dp_fan2 - dp_fan1);
      const p_op = interpolatePower(fan, q_op);
      return { q_m3h: q_op, psf_pa: dp_op, p1_w: p_op };
    }
  }
  return null;
}
