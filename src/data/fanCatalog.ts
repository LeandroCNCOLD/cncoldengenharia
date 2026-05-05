// Catálogo Completo de Ventiladores — CN Coils
// Gerado automaticamente a partir dos datasheets oficiais
// Fabricantes: Ziehl-Abegg, EBM Papst, Sell Parts
// Total: 31 modelos com curvas de desempenho reais

export interface FanCurvePoint {
  q_m3h: number;      // Vazão em m³/h
  psf_pa: number;     // Pressão estática em Pa
  p1_w?: number;      // Potência elétrica em W (opcional)
}

export interface FanModel {
  model: string;              // Type key (ex: FN056-4DK.4M.V7P2)
  manufacturer: string;       // Fabricante
  article_number: string;     // Número de artigo
  diameter_mm: number;        // Diâmetro em mm
  electrical_nominal: string; // Dados elétricos nominais
  rpm_nominal: number;        // RPM nominal
  sound_lwa_db: number;       // Nível de potência sonora LwA [dB(A)]
  erp_efficiency_pct: number; // Eficiência estática ErP [%]
  q_max_m3h: number;          // Vazão máxima (pressão zero) [m³/h]
  dp_max_pa: number;          // Pressão máxima (vazão zero) [Pa]
  p1_nominal_w: number;       // Potência nominal [W]
  curve_points: FanCurvePoint[]; // Pontos da curva Q×ΔP
}

export const FAN_CATALOG: FanModel[] = [
  {
    "model": "FN035-4EK.0F.V7P2",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "155883",
    "diameter_mm": 350,
    "electrical_nominal": "1~230V, 50Hz, P1 230W, 1.05A, 1410 RPM",
    "rpm_nominal": 1410,
    "sound_lwa_db": 72.0,
    "erp_efficiency_pct": 25.8,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 120.0,
        "p1_w": 100.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 115.0,
        "p1_w": 110.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 105.0,
        "p1_w": 125.0
      },
      {
        "q_m3h": 1500.0,
        "psf_pa": 90.0,
        "p1_w": 140.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 70.0,
        "p1_w": 160.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 50.0,
        "p1_w": 180.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 25.0,
        "p1_w": 200.0
      },
      {
        "q_m3h": 3300.0,
        "psf_pa": 10.0,
        "p1_w": 230.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 3300.0,
    "dp_max_pa": 120.0,
    "p1_nominal_w": 230.0,
    "source_file": "Ziehl-Abegg - 350 mm - FN035-4EK.0F.V7P2 - 155883.pdf"
  },
  {
    "model": "FN035-4DK.0F.V7P2",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "157229",
    "diameter_mm": 353,
    "electrical_nominal": "3~230/400V, 50Hz, P1 0.19kW, 0.69/0.40A, 1390 RPM",
    "rpm_nominal": 1390,
    "sound_lwa_db": 81.5,
    "erp_efficiency_pct": 29.3,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 230.0,
        "p1_w": 190.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 200.0,
        "p1_w": 190.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 160.0,
        "p1_w": 190.0
      },
      {
        "q_m3h": 1500.0,
        "psf_pa": 120.0,
        "p1_w": 190.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 80.0,
        "p1_w": 190.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 40.0,
        "p1_w": 190.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 0.0,
        "p1_w": 190.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 3000.0,
    "dp_max_pa": 230.0,
    "p1_nominal_w": 190.0,
    "source_file": "Ziehl-Abegg - 350 mm - FN035-4DK.0F.V7P2 - 157229_EN.pdf"
  },
  {
    "model": "S4D400-AP24-61",
    "manufacturer": "EBM Papst",
    "article_number": "16196-5-9980",
    "diameter_mm": 400,
    "electrical_nominal": "400 VAC, 3 fases, 50 Hz, 0.14 kW, 0.27 A, 1340 RPM",
    "rpm_nominal": 1340,
    "sound_lwa_db": 81.5,
    "erp_efficiency_pct": 33.4,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 155.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 140.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 115.0
      },
      {
        "q_m3h": 1500.0,
        "psf_pa": 80.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 45.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 15.0
      },
      {
        "q_m3h": 2710.0,
        "psf_pa": 0.0,
        "p1_w": 140.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 2710.0,
    "dp_max_pa": 155.0,
    "p1_nominal_w": 140.0,
    "source_file": "EBM PAPST - 400 mm - S4D400AP2461.pdf"
  },
  {
    "model": "S4E400-AP02-39",
    "manufacturer": "EBM Papst",
    "article_number": "S4E400-AP02-39",
    "diameter_mm": 400,
    "electrical_nominal": "230V, 1~, 50Hz, P1 0.73kW, 0.73A, 1430 RPM",
    "rpm_nominal": 1430,
    "sound_lwa_db": 74.0,
    "erp_efficiency_pct": 31.9,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 120.0,
        "p1_w": 100.0
      },
      {
        "q_m3h": 240.0,
        "psf_pa": 100.0,
        "p1_w": 160.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 85.0,
        "p1_w": 180.0
      },
      {
        "q_m3h": 720.0,
        "psf_pa": 72.0,
        "p1_w": 200.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 55.0,
        "p1_w": 215.0
      },
      {
        "q_m3h": 1200.0,
        "psf_pa": 44.0,
        "p1_w": 225.0
      },
      {
        "q_m3h": 1400.0,
        "psf_pa": 25.0,
        "p1_w": 235.0
      },
      {
        "q_m3h": 1620.0,
        "psf_pa": 10.0,
        "p1_w": 250.0
      },
      {
        "q_m3h": 1750.0,
        "psf_pa": 0.0,
        "p1_w": 260.0
      }
    ],
    "num_curve_points": 9,
    "q_max_m3h": 1750.0,
    "dp_max_pa": 120.0,
    "p1_nominal_w": 260.0,
    "source_file": "EBM PAPST - 400 mm - S4E400AP0239.pdf"
  },
  {
    "model": "FS/4-400 ET",
    "manufacturer": "Sell-Parts",
    "article_number": "N/A",
    "diameter_mm": 400,
    "electrical_nominal": "220/380 V, Trifásica, 50/60 Hz, 0,80 A / 1,0 A (220V) | 0,48 A / 0,60 A (380V), 230 W, 1570 RPM",
    "rpm_nominal": 1570,
    "sound_lwa_db": 67.0,
    "erp_efficiency_pct": 0.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 90.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 80.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 70.0
      },
      {
        "q_m3h": 1500.0,
        "psf_pa": 60.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 50.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 40.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 30.0
      },
      {
        "q_m3h": 3500.0,
        "psf_pa": 20.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 10.0
      },
      {
        "q_m3h": 4500.0,
        "psf_pa": 0.0
      }
    ],
    "num_curve_points": 10,
    "q_max_m3h": 4500.0,
    "dp_max_pa": 90.0,
    "p1_nominal_w": 0,
    "source_file": "Sell Parts - 400 mm - FS4-400ET.pdf"
  },
  {
    "model": "FN040-4DK.0F.V7P1",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "157237",
    "diameter_mm": 400,
    "electrical_nominal": "3~230V, 50Hz, P1 0.23 kW, 0.80/0.46A, 1360 RPM",
    "rpm_nominal": 1360,
    "sound_lwa_db": 72.0,
    "erp_efficiency_pct": 33.2,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 265.0,
        "p1_w": 105.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 250.0,
        "p1_w": 120.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 230.0,
        "p1_w": 150.0
      },
      {
        "q_m3h": 1500.0,
        "psf_pa": 190.0,
        "p1_w": 190.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 140.0,
        "p1_w": 230.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 80.0,
        "p1_w": 260.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 20.0,
        "p1_w": 280.0
      },
      {
        "q_m3h": 3200.0,
        "psf_pa": 0.0,
        "p1_w": 285.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 3200.0,
    "dp_max_pa": 265.0,
    "p1_nominal_w": 285.0,
    "source_file": "Ziehl-Abegg - 400 mm - FN040-4DK.0F.V7P1 - 157237.pdf"
  },
  {
    "model": "FN040-4EK.2F.V7P1",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "154300",
    "diameter_mm": 400,
    "electrical_nominal": "1~ 230V, 50Hz, P1 0.28kW, 1.30A, 1380 RPM",
    "rpm_nominal": 1380,
    "sound_lwa_db": 73.0,
    "erp_efficiency_pct": 36.6,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 230.0,
        "p1_w": 230.0
      },
      {
        "q_m3h": 500.0,
        "psf_pa": 220.0,
        "p1_w": 240.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 190.0,
        "p1_w": 260.0
      },
      {
        "q_m3h": 1500.0,
        "psf_pa": 150.0,
        "p1_w": 270.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 100.0,
        "p1_w": 280.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 40.0,
        "p1_w": 290.0
      },
      {
        "q_m3h": 2700.0,
        "psf_pa": 0.0,
        "p1_w": 295.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 2700.0,
    "dp_max_pa": 230.0,
    "p1_nominal_w": 295.0,
    "source_file": "Ziehl-Abegg - 400 mm - FN040-4EK.2F.V7P1 - 154300.pdf"
  },
  {
    "model": "FS/4-450 ET 01",
    "manufacturer": "Sell Parts",
    "article_number": "FS/4-450 ET 01",
    "diameter_mm": 450,
    "electrical_nominal": "220/380V, Trifásica, 50/60Hz, P1 0.32 kW, 0.98 A (220V), 1640 RPM",
    "rpm_nominal": 1640,
    "sound_lwa_db": 68.0,
    "erp_efficiency_pct": 0.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 85.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 80.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 70.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 55.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 35.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 15.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 5.0
      },
      {
        "q_m3h": 6500.0,
        "psf_pa": 0.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 6500.0,
    "dp_max_pa": 85.0,
    "p1_nominal_w": 0,
    "source_file": "Sell Parts - 450 mm - FS4-450ET.pdf"
  },
  {
    "model": "FS/4-450 ET PW",
    "manufacturer": "Sell Parts",
    "article_number": "FS/4-450 ET PW",
    "diameter_mm": 450,
    "electrical_nominal": "220/380 V, Trifásica, 60 Hz, 730 W, 2.40 A (220V), 1600 RPM",
    "rpm_nominal": 1600,
    "sound_lwa_db": 75.0,
    "erp_efficiency_pct": 0.0,
    "curve_points": [
      {
        "q_m3h": 5000.0,
        "psf_pa": 175.0
      },
      {
        "q_m3h": 5500.0,
        "psf_pa": 140.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 105.0
      },
      {
        "q_m3h": 6500.0,
        "psf_pa": 70.0
      },
      {
        "q_m3h": 7000.0,
        "psf_pa": 35.0
      },
      {
        "q_m3h": 7250.0,
        "psf_pa": 0.0
      }
    ],
    "num_curve_points": 6,
    "q_max_m3h": 7250.0,
    "dp_max_pa": 175.0,
    "p1_nominal_w": 0,
    "source_file": "Sell Parts - 450 mm - FS4 450 ET PW.pdf"
  },
  {
    "model": "FN045-4D.2F.V7P2",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "N/A",
    "diameter_mm": 450,
    "electrical_nominal": "265/460 V (Δ/Y), 60 Hz, 0.49 kW, 1.40/0.80 A, 1450 RPM",
    "rpm_nominal": 1450,
    "sound_lwa_db": 68.0,
    "erp_efficiency_pct": 33.7,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 148.0,
        "p1_w": 490.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 135.0,
        "p1_w": 490.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 115.0,
        "p1_w": 490.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 90.0,
        "p1_w": 490.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 60.0,
        "p1_w": 490.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 30.0,
        "p1_w": 490.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 0.0,
        "p1_w": 490.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 6000.0,
    "dp_max_pa": 148.0,
    "p1_nominal_w": 490.0,
    "source_file": "Ziehl-Abegg - 450 mm - FN045-4D_.2F._7P1.pdf"
  },
  {
    "model": "FN045-4DK.4I.V7P1",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "159588",
    "diameter_mm": 450,
    "electrical_nominal": "3~230/400V D/Y 50Hz P1 0.52kW 2.1/1.2A 1320rpm",
    "rpm_nominal": 1320,
    "sound_lwa_db": 74.0,
    "erp_efficiency_pct": 0.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 155.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 145.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 125.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 95.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 55.0
      },
      {
        "q_m3h": 4500.0,
        "psf_pa": 30.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 0.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 5000.0,
    "dp_max_pa": 155.0,
    "p1_nominal_w": 0,
    "source_file": "Ziehl-Abegg - 450 mm - FN045-4D_.4I.V7P1 - 159588.pdf"
  },
  {
    "model": "FN045-4DQ.4I.V7P1",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "160983",
    "diameter_mm": 450,
    "electrical_nominal": "3~230/400V D/Y 50Hz P(1) 0.52kW, 2.1/1.2A ΔI=0% 1320/min COSY 0,62 80°C",
    "rpm_nominal": 1320,
    "sound_lwa_db": 72.0,
    "erp_efficiency_pct": 32.9,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 90.0,
        "p1_w": 100.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 80.0,
        "p1_w": 200.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 68.0,
        "p1_w": 300.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 50.0,
        "p1_w": 400.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 30.0,
        "p1_w": 500.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 10.0,
        "p1_w": 550.0
      },
      {
        "q_m3h": 5500.0,
        "psf_pa": 0.0,
        "p1_w": 580.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 5500.0,
    "dp_max_pa": 90.0,
    "p1_nominal_w": 580.0,
    "source_file": "Ziehl-Abegg - 450 mm - FN045-4DQ.4I.V7P1 - 160983 - 230v.pdf"
  },
  {
    "model": "S4D500-AM01-03",
    "manufacturer": "EBM Papst",
    "article_number": "N/A",
    "diameter_mm": 500,
    "electrical_nominal": "Tensão: 400V, Fases: 3, Hz: 50, P1 kW: 0.69, Corrente A: 1.27, RPM nominal: 1350",
    "rpm_nominal": 1350,
    "sound_lwa_db": 73.0,
    "erp_efficiency_pct": 33.3,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 155.0,
        "p1_w": 100.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 145.0,
        "p1_w": 200.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 125.0,
        "p1_w": 350.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 90.0,
        "p1_w": 550.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 50.0,
        "p1_w": 700.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 15.0,
        "p1_w": 750.0
      },
      {
        "q_m3h": 5130.0,
        "psf_pa": 0.0,
        "p1_w": 680.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 5130.0,
    "dp_max_pa": 155.0,
    "p1_nominal_w": 750.0,
    "source_file": "EBM PAPST - 500 mm - S4D500AM0103.pdf"
  },
  {
    "model": "W4D500-KM21-10",
    "manufacturer": "EBM Papst",
    "article_number": "16392-5-9980",
    "diameter_mm": 500,
    "electrical_nominal": "400V, 3 fases, 50Hz, 0.78 kW, 1.78 A, 1415 RPM",
    "rpm_nominal": 1415,
    "sound_lwa_db": 78.0,
    "erp_efficiency_pct": 39.1,
    "curve_points": [
      {
        "q_m3h": 5895.0,
        "psf_pa": 185.0,
        "p1_w": 780.0
      },
      {
        "q_m3h": 7100.0,
        "psf_pa": 130.0,
        "p1_w": 729.0
      },
      {
        "q_m3h": 8255.0,
        "psf_pa": 70.0,
        "p1_w": 690.0
      },
      {
        "q_m3h": 9300.0,
        "psf_pa": 0.0,
        "p1_w": 582.0
      }
    ],
    "num_curve_points": 4,
    "q_max_m3h": 9300.0,
    "dp_max_pa": 185.0,
    "p1_nominal_w": 780.0,
    "source_file": "EBM PAPST - 500 mm - W4D500KM2110.pdf"
  },
  {
    "model": "FN050-4DK.4I.V7P1",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "153540",
    "diameter_mm": 500,
    "electrical_nominal": "3- 230/400V 50Hz P1 0.77kW, 2.95/1.7A, 1300 RPM",
    "rpm_nominal": 1300,
    "sound_lwa_db": 72.0,
    "erp_efficiency_pct": 33.7,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 165.0,
        "p1_w": 400.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 160.0,
        "p1_w": 420.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 150.0,
        "p1_w": 450.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 135.0,
        "p1_w": 480.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 115.0,
        "p1_w": 500.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 90.0,
        "p1_w": 520.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 60.0,
        "p1_w": 530.0
      },
      {
        "q_m3h": 7000.0,
        "psf_pa": 25.0,
        "p1_w": 530.0
      },
      {
        "q_m3h": 7500.0,
        "psf_pa": 0.0,
        "p1_w": 520.0
      }
    ],
    "num_curve_points": 9,
    "q_max_m3h": 7500.0,
    "dp_max_pa": 165.0,
    "p1_nominal_w": 530.0,
    "source_file": "Ziehl-Abegg - 500 mm - FN050-4DK 4I V7P1 153540.pdf"
  },
  {
    "model": "ZN050-4DQ.4I.V7P1",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "167732",
    "diameter_mm": 500,
    "electrical_nominal": "3~230/400V D/Y 60Hz P(1) 1.15kW 3.7/2.1A 1480/min COSY 0,76",
    "rpm_nominal": 1480,
    "sound_lwa_db": 70.0,
    "erp_efficiency_pct": 0.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 115.0,
        "p1_w": 200.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 105.0,
        "p1_w": 250.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 90.0,
        "p1_w": 300.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 70.0,
        "p1_w": 350.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 45.0,
        "p1_w": 400.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 25.0,
        "p1_w": 450.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 10.0,
        "p1_w": 500.0
      },
      {
        "q_m3h": 7000.0,
        "psf_pa": 0.0,
        "p1_w": 550.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 7000.0,
    "dp_max_pa": 115.0,
    "p1_nominal_w": 550.0,
    "source_file": "Ziehl-Abegg - 500 mm - ZN050-4DQ.4I.V7P1 - 167732 - 220v.pdf"
  },
  {
    "model": "FN056-4DK.4M.V7P2",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "N/A",
    "diameter_mm": 560,
    "electrical_nominal": "3~230/400V ±10% D/Y 50Hz P1 1.05kW, 3.8/2.2A, 1280rpm",
    "rpm_nominal": 1280,
    "sound_lwa_db": 82.5,
    "erp_efficiency_pct": 70.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 260.0,
        "p1_w": 1500.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 250.0,
        "p1_w": 1450.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 225.0,
        "p1_w": 1350.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 180.0,
        "p1_w": 1200.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 120.0,
        "p1_w": 1000.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 50.0,
        "p1_w": 800.0
      },
      {
        "q_m3h": 11000.0,
        "psf_pa": 10.0,
        "p1_w": 700.0
      },
      {
        "q_m3h": 11500.0,
        "psf_pa": 0.0,
        "p1_w": 650.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 11500.0,
    "dp_max_pa": 260.0,
    "p1_nominal_w": 1500.0,
    "source_file": "Ziehl-Abegg - 560 mm - FN056-4DK.4M.V7P2_162306_performance.pdf"
  },
  {
    "model": "S4D630-AF03-03",
    "manufacturer": "EBM Papst",
    "article_number": "13462-5-9980",
    "diameter_mm": 630,
    "electrical_nominal": "400 V, 3 fases, 50 Hz, 1.72 kW, 3.86 A, 1405 RPM",
    "rpm_nominal": 1405,
    "sound_lwa_db": 82.0,
    "erp_efficiency_pct": 36.4,
    "curve_points": [
      {
        "q_m3h": 2000.0,
        "psf_pa": 330.0,
        "p1_w": 1100.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 270.0,
        "p1_w": 1250.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 220.0,
        "p1_w": 1400.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 170.0,
        "p1_w": 1550.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 120.0,
        "p1_w": 1700.0
      },
      {
        "q_m3h": 12000.0,
        "psf_pa": 70.0,
        "p1_w": 1850.0
      },
      {
        "q_m3h": 14000.0,
        "psf_pa": 20.0,
        "p1_w": 2000.0
      },
      {
        "q_m3h": 14500.0,
        "psf_pa": 0.0,
        "p1_w": 2050.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 14500.0,
    "dp_max_pa": 330.0,
    "p1_nominal_w": 2050.0,
    "source_file": "EBM PAPST - 630 mm - S4D630AF0303-ENG.pdf"
  },
  {
    "model": "W6D630-GN09-03",
    "manufacturer": "EBM Papst",
    "article_number": "13565-5-9980",
    "diameter_mm": 630,
    "electrical_nominal": "400V, 3~, 50Hz, 0.64kW, 1.45A, 890RPM",
    "rpm_nominal": 890,
    "sound_lwa_db": 68.0,
    "erp_efficiency_pct": 32.4,
    "curve_points": [
      {
        "q_m3h": 6495.0,
        "psf_pa": 110.0,
        "p1_w": 640.0
      },
      {
        "q_m3h": 8145.0,
        "psf_pa": 80.0,
        "p1_w": 598.0
      },
      {
        "q_m3h": 9855.0,
        "psf_pa": 40.0,
        "p1_w": 528.0
      },
      {
        "q_m3h": 11315.0,
        "psf_pa": 0.0,
        "p1_w": 447.0
      }
    ],
    "num_curve_points": 4,
    "q_max_m3h": 11315.0,
    "dp_max_pa": 110.0,
    "p1_nominal_w": 640.0,
    "source_file": "EBM PAPST - 630mm - W6D630GN0903.pdf"
  },
  {
    "model": "FS/4-630 ET",
    "manufacturer": "Sell Parts",
    "article_number": "FS/4-630 ET",
    "diameter_mm": 630,
    "electrical_nominal": "220/380V, Trifásica, 50/60Hz, 1000 W, 2.80 A/1.62 A",
    "rpm_nominal": 1560,
    "sound_lwa_db": 81.0,
    "erp_efficiency_pct": 0.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 140.0
      },
      {
        "q_m3h": 1000.0,
        "psf_pa": 138.0
      },
      {
        "q_m3h": 3000.0,
        "psf_pa": 130.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 115.0
      },
      {
        "q_m3h": 7000.0,
        "psf_pa": 90.0
      },
      {
        "q_m3h": 9000.0,
        "psf_pa": 50.0
      },
      {
        "q_m3h": 11000.0,
        "psf_pa": 0.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 11000.0,
    "dp_max_pa": 140.0,
    "p1_nominal_w": 0,
    "source_file": "SELL PARTS - 630 mm - FS4-630ET.pdf"
  },
  {
    "model": "FS/4-630 VT",
    "manufacturer": "Sell Parts",
    "article_number": "FS/4-630 VT",
    "diameter_mm": 630,
    "electrical_nominal": "220/380V, Trifásica, 50/60Hz, 1000 W, (220V) 3.40/3.10A - (380V) 1.95/1.70A, 1630 RPM",
    "rpm_nominal": 1630,
    "sound_lwa_db": 81.0,
    "erp_efficiency_pct": 33.7,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 145.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 135.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 120.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 100.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 70.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 30.0
      },
      {
        "q_m3h": 11000.0,
        "psf_pa": 10.0
      },
      {
        "q_m3h": 11500.0,
        "psf_pa": 0.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 11500.0,
    "dp_max_pa": 145.0,
    "p1_nominal_w": 0,
    "source_file": "FS4-630 VT.pdf"
  },
  {
    "model": "HR/6-630 ET",
    "manufacturer": "Sell Parts",
    "article_number": "",
    "diameter_mm": 630,
    "electrical_nominal": "220/380V, Trifásica, 50/60Hz, 2,58 A (220 V), 660W, 950 RPM",
    "rpm_nominal": 950,
    "sound_lwa_db": 74.0,
    "erp_efficiency_pct": 0.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 100.0
      },
      {
        "q_m3h": 7000.0,
        "psf_pa": 80.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 65.0
      },
      {
        "q_m3h": 9000.0,
        "psf_pa": 50.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 35.0
      },
      {
        "q_m3h": 11000.0,
        "psf_pa": 20.0
      },
      {
        "q_m3h": 12000.0,
        "psf_pa": 10.0
      },
      {
        "q_m3h": 13000.0,
        "psf_pa": 0.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 13000.0,
    "dp_max_pa": 100.0,
    "p1_nominal_w": 0,
    "source_file": "SELL PARTS - 630 mm - HR6-630 ET.pdf"
  },
  {
    "model": "FN063-4DK.6N.V7P6",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "165630",
    "diameter_mm": 630,
    "electrical_nominal": "3- 230/400V ±10% D/Y 50Hz P1 1,75kW, 6,4/3,7A, 1400/MIN",
    "rpm_nominal": 1400,
    "sound_lwa_db": 88.0,
    "erp_efficiency_pct": 60.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 255.0,
        "p1_w": 1000.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 245.0,
        "p1_w": 1050.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 230.0,
        "p1_w": 1150.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 210.0,
        "p1_w": 1250.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 180.0,
        "p1_w": 1350.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 140.0,
        "p1_w": 1450.0
      },
      {
        "q_m3h": 12000.0,
        "psf_pa": 90.0,
        "p1_w": 1550.0
      },
      {
        "q_m3h": 14000.0,
        "psf_pa": 30.0,
        "p1_w": 1650.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 14000.0,
    "dp_max_pa": 255.0,
    "p1_nominal_w": 1650.0,
    "source_file": "Ziehl-Abegg - 630 mm - FN063-4DK.6N.V7P6 - 163702m.pdf"
  },
  {
    "model": "FN063-4DW.6N.A7P6",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "172786",
    "diameter_mm": 630,
    "electrical_nominal": "3~230/400V, 50Hz, P1 1.75kW, 6.40/3.70A, 1400 RPM",
    "rpm_nominal": 1400,
    "sound_lwa_db": 82.0,
    "erp_efficiency_pct": 37.5,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 460.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 380.0,
        "p1_w": 800.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 265.0,
        "p1_w": 1000.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 165.0,
        "p1_w": 1200.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 105.0,
        "p1_w": 1500.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 50.0,
        "p1_w": 1700.0
      },
      {
        "q_m3h": 12000.0,
        "psf_pa": 20.0,
        "p1_w": 1900.0
      },
      {
        "q_m3h": 14000.0,
        "psf_pa": 0.0,
        "p1_w": 2000.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 14000.0,
    "dp_max_pa": 460.0,
    "p1_nominal_w": 2000.0,
    "source_file": "FN063-4DW.6N.A7P6_172786_PT.pdf"
  },
  {
    "model": "FN063-6DK.4M.V7P1",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "155614",
    "diameter_mm": 630,
    "electrical_nominal": "Tensão: 230/400V, Fases: 3, Frequência: 50Hz, P1: 0.59kW, Corrente: 2.4/1.4A, RPM: 910",
    "rpm_nominal": 910,
    "sound_lwa_db": 74.5,
    "erp_efficiency_pct": 0.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 122.0,
        "p1_w": 250.0
      },
      {
        "q_m3h": 2000.0,
        "psf_pa": 118.0,
        "p1_w": 300.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 105.0,
        "p1_w": 400.0
      },
      {
        "q_m3h": 6000.0,
        "psf_pa": 80.0,
        "p1_w": 500.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 50.0,
        "p1_w": 600.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 20.0,
        "p1_w": 650.0
      },
      {
        "q_m3h": 11000.0,
        "psf_pa": 0.0,
        "p1_w": 670.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 11000.0,
    "dp_max_pa": 122.0,
    "p1_nominal_w": 670.0,
    "source_file": "Ziehl-Abegg - 630 mm - FN063-6DK 4M V7P1 - 155614.pdf"
  },
  {
    "model": "FS/6-800 ET DF",
    "manufacturer": "Sell Parts",
    "article_number": "FS/6-800 ET DF",
    "diameter_mm": 800,
    "electrical_nominal": "220/380V, Trifásica, 60 Hz, 2.2 kW, 7.5 A (220V), 1080 RPM",
    "rpm_nominal": 1080,
    "sound_lwa_db": 82.0,
    "erp_efficiency_pct": 0.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 145.0
      },
      {
        "q_m3h": 4000.0,
        "psf_pa": 135.0
      },
      {
        "q_m3h": 8000.0,
        "psf_pa": 120.0
      },
      {
        "q_m3h": 12000.0,
        "psf_pa": 100.0
      },
      {
        "q_m3h": 16000.0,
        "psf_pa": 75.0
      },
      {
        "q_m3h": 20000.0,
        "psf_pa": 45.0
      },
      {
        "q_m3h": 24000.0,
        "psf_pa": 15.0
      },
      {
        "q_m3h": 25000.0,
        "psf_pa": 0.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 25000.0,
    "dp_max_pa": 145.0,
    "p1_nominal_w": 0,
    "source_file": "SELL PARTS - 800 mm - FS6-800ET DF.pdf"
  },
  {
    "model": "FN080-6DQ.6N.V7",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "155610",
    "diameter_mm": 800,
    "electrical_nominal": "3~ 230/400V +10/-10 D/Y 50Hz P1 1.60kW 6.20/3.60A DI=0% 870/MIN COSY 0.66 70°C",
    "rpm_nominal": 870,
    "sound_lwa_db": 77.0,
    "erp_efficiency_pct": 40.9,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 270.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 200.0,
        "p1_w": 200.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 100.0,
        "p1_w": 600.0
      },
      {
        "q_m3h": 14000.0,
        "psf_pa": 155.0,
        "p1_w": 1200.0
      },
      {
        "q_m3h": 15000.0,
        "psf_pa": 140.0,
        "p1_w": 1300.0
      },
      {
        "q_m3h": 20000.0,
        "psf_pa": 70.0,
        "p1_w": 1800.0
      },
      {
        "q_m3h": 25000.0,
        "psf_pa": 20.0,
        "p1_w": 2000.0
      },
      {
        "q_m3h": 28000.0,
        "psf_pa": 0.0,
        "p1_w": 2100.0
      }
    ],
    "num_curve_points": 8,
    "q_max_m3h": 28000.0,
    "dp_max_pa": 270.0,
    "p1_nominal_w": 2100.0,
    "source_file": "ZIEHL-ABEGG - 800 mm - FN080-6DQ.6N.V7-155610.pdf"
  },
  {
    "model": "FN080-SDQ.6N.V7",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "140587",
    "diameter_mm": 800,
    "electrical_nominal": "3~ 400V±10% D/Y 50Hz P1 1.60/1.0kW 3.6/1.8A ΔI=0% 870/670/min COSY 0.66 70°C",
    "rpm_nominal": 870,
    "sound_lwa_db": 68.0,
    "erp_efficiency_pct": 36.0,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 260.0,
        "p1_w": 500.0
      },
      {
        "q_m3h": 2500.0,
        "psf_pa": 230.0,
        "p1_w": 600.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 200.0,
        "p1_w": 700.0
      },
      {
        "q_m3h": 7500.0,
        "psf_pa": 150.0,
        "p1_w": 900.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 100.0,
        "p1_w": 1100.0
      },
      {
        "q_m3h": 12500.0,
        "psf_pa": 50.0,
        "p1_w": 1200.0
      },
      {
        "q_m3h": 14000.0,
        "psf_pa": 0.0,
        "p1_w": 1250.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 14000.0,
    "dp_max_pa": 260.0,
    "p1_nominal_w": 1250.0,
    "source_file": "ZIEHL-ABEGG - 800 mm - FN080-SDQ.6N.V7  - 140587.pdf"
  },
  {
    "model": "ZN080-ZIQ.GL.V7P3",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "161405",
    "diameter_mm": 800,
    "electrical_nominal": "3~380-480V 50/60Hz P 2,80kW 4.40-3.50A 1100 min-1",
    "rpm_nominal": 1100,
    "sound_lwa_db": 86.0,
    "erp_efficiency_pct": 58.0,
    "curve_points": [
      {
        "q_m3h": 10000.0,
        "psf_pa": 320.0,
        "p1_w": 2700.0
      },
      {
        "q_m3h": 12500.0,
        "psf_pa": 290.0,
        "p1_w": 2800.0
      },
      {
        "q_m3h": 15000.0,
        "psf_pa": 250.0,
        "p1_w": 2700.0
      },
      {
        "q_m3h": 17500.0,
        "psf_pa": 200.0,
        "p1_w": 2500.0
      },
      {
        "q_m3h": 20000.0,
        "psf_pa": 150.0,
        "p1_w": 2200.0
      },
      {
        "q_m3h": 22500.0,
        "psf_pa": 100.0,
        "p1_w": 1900.0
      },
      {
        "q_m3h": 25000.0,
        "psf_pa": 50.0,
        "p1_w": 1600.0
      }
    ],
    "num_curve_points": 7,
    "q_max_m3h": 25000.0,
    "dp_max_pa": 320.0,
    "p1_nominal_w": 2800.0,
    "source_file": "ZIEHL-ABEGG - 800 mm - ZN080-ZIQ.GL.V7P3 - 161405.pdf"
  },
  {
    "model": "FN091-SDK.6N.V7P2",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "162029",
    "diameter_mm": 905,
    "electrical_nominal": "3~400V, 50Hz, P1 1,85/1,05kW, 3,80/1,90A, 840/630 RPM",
    "rpm_nominal": 840,
    "sound_lwa_db": 82.0,
    "erp_efficiency_pct": 39.2,
    "curve_points": [
      {
        "q_m3h": 0.0,
        "psf_pa": 190.0,
        "p1_w": 1000.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 170.0,
        "p1_w": 1100.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 140.0,
        "p1_w": 1300.0
      },
      {
        "q_m3h": 15000.0,
        "psf_pa": 90.0,
        "p1_w": 1500.0
      },
      {
        "q_m3h": 20000.0,
        "psf_pa": 30.0,
        "p1_w": 1700.0
      },
      {
        "q_m3h": 22000.0,
        "psf_pa": 0.0,
        "p1_w": 1800.0
      }
    ],
    "num_curve_points": 6,
    "q_max_m3h": 22000.0,
    "dp_max_pa": 190.0,
    "p1_nominal_w": 1800.0,
    "source_file": "Fn091.pdf"
  },
  {
    "model": "FN091-SD_.6N._7P2",
    "manufacturer": "Ziehl-Abegg",
    "article_number": "156204",
    "diameter_mm": 910,
    "electrical_nominal": "3~ 400 V, 50 Hz, 1.85 kW, 3.80 A, 840 RPM",
    "rpm_nominal": 840,
    "sound_lwa_db": 88.0,
    "erp_efficiency_pct": 39.2,
    "curve_points": [
      {
        "q_m3h": 1000.0,
        "psf_pa": 270.0,
        "p1_w": 1800.0
      },
      {
        "q_m3h": 5000.0,
        "psf_pa": 250.0,
        "p1_w": 1850.0
      },
      {
        "q_m3h": 10000.0,
        "psf_pa": 200.0,
        "p1_w": 1800.0
      },
      {
        "q_m3h": 15000.0,
        "psf_pa": 120.0,
        "p1_w": 1600.0
      },
      {
        "q_m3h": 20000.0,
        "psf_pa": 40.0,
        "p1_w": 1200.0
      },
      {
        "q_m3h": 22000.0,
        "psf_pa": 0.0,
        "p1_w": 1000.0
      }
    ],
    "num_curve_points": 6,
    "q_max_m3h": 22000.0,
    "dp_max_pa": 270.0,
    "p1_nominal_w": 1850.0,
    "source_file": "60-fn091-sd_-6n-_7p2-ziehl-abegg-catalog-en.pdf"
  }
];

/** Interpola pressão estática para uma dada vazão */
export function interpolatePressure(fan: FanModel, q_m3h: number): number {
  const pts = fan.curve_points;
  if (!pts || pts.length < 2) return 0;
  if (q_m3h <= pts[0].q_m3h) return pts[0].psf_pa;
  if (q_m3h >= pts[pts.length - 1].q_m3h) return 0;
  for (let i = 0; i < pts.length - 1; i++) {
    if (q_m3h >= pts[i].q_m3h && q_m3h <= pts[i + 1].q_m3h) {
      const t = (q_m3h - pts[i].q_m3h) / (pts[i + 1].q_m3h - pts[i].q_m3h);
      return pts[i].psf_pa + t * (pts[i + 1].psf_pa - pts[i].psf_pa);
    }
  }
  return 0;
}

/** Interpola potência para uma dada vazão */
export function interpolatePower(fan: FanModel, q_m3h: number): number {
  const pts = fan.curve_points.filter(p => p.p1_w != null);
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

/** Encontra o ponto de operação: interseção curva do ventilador × curva do sistema (ΔP = R×Q²) */
export function findOperatingPoint(
  fan: FanModel,
  systemResistance: number
): { q_m3h: number; psf_pa: number; p1_w: number } | null {
  const pts = fan.curve_points;
  if (!pts || pts.length < 2) return null;
  for (let i = 0; i < pts.length - 1; i++) {
    const q1 = pts[i].q_m3h, q2 = pts[i + 1].q_m3h;
    const dp1 = pts[i].psf_pa, dp2 = pts[i + 1].psf_pa;
    const sys1 = systemResistance * q1 * q1, sys2 = systemResistance * q2 * q2;
    if ((dp1 - sys1) * (dp2 - sys2) <= 0) {
      const t = (dp1 - sys1) / ((sys2 - sys1) - (dp2 - dp1));
      const q_op = q1 + t * (q2 - q1);
      const dp_op = dp1 + t * (dp2 - dp1);
      return { q_m3h: q_op, psf_pa: dp_op, p1_w: interpolatePower(fan, q_op) };
    }
  }
  return null;
}

/** Filtra ventiladores por diâmetro e/ou fabricante */
export function filterFans(opts: {
  diameter_mm?: number;
  manufacturer?: string;
  min_q_m3h?: number;
  min_dp_pa?: number;
}): FanModel[] {
  return FAN_CATALOG.filter(f => {
    if (opts.diameter_mm && f.diameter_mm !== opts.diameter_mm) return false;
    if (opts.manufacturer && !f.manufacturer.toLowerCase().includes(opts.manufacturer.toLowerCase())) return false;
    if (opts.min_q_m3h && f.q_max_m3h < opts.min_q_m3h) return false;
    if (opts.min_dp_pa && f.dp_max_pa < opts.min_dp_pa) return false;
    return true;
  });
}

/** Seleciona o ventilador mais adequado para um ponto de operação */
export function selectFan(q_m3h: number, dp_pa: number): FanModel | null {
  const candidates = FAN_CATALOG.filter(f =>
    f.q_max_m3h >= q_m3h * 1.1 && f.dp_max_pa >= dp_pa * 1.1
  );
  if (!candidates.length) return null;
  // Retorna o menor ventilador que atende ao requisito
  return candidates.sort((a, b) => a.diameter_mm - b.diameter_mm)[0];
}
