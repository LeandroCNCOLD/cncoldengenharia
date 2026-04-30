-- Recriação completa do banco de dados do Catálogo CN (equipamentos consolidados)
-- 118 colunas conforme planilha fornecida pelo usuário

CREATE TABLE public.cn_equipment_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,

  -- Identificação (1-19)
  modelo text,
  modelo_unico text,
  status_compressor text,
  modelo_catalogo_original text,
  modelo_base_referencia text,
  fabricante text,
  fabricante_origem text,
  compressor text,
  compressor_codigo text,
  tipo_compressor text,
  configuracao_eletrica text,
  tensao_eletrica_v text,
  tensao_v numeric,
  numero_fases integer,
  frequencia_hz numeric,
  linha text,
  designacao_comercial_hp text,
  gabinete text,
  tipo_de_gabinete text,

  -- Refrigerante e desempenho global (20-30)
  refrigerante text,
  capacidade_frig_reaquecimento_kcalh numeric,
  capacidade_frig_compressor_kcalh numeric,
  calor_rejeitado_condensador_kcalh numeric,
  potencia_elet_requerida_total_circuito_kw numeric,
  corrente_elet_estimada_circuito_a numeric,
  corrente_elet_partida_circuito_a numeric,
  cop_global_kw_kw numeric,
  gwp_ar6 numeric,
  odp_ar6 numeric,
  tipo_de_degelo text,

  -- Condensador (31-41)
  cond_rows integer,
  cond_tubes_per_row integer,
  cond_circuits integer,
  cond_fin_spacing_mm numeric,
  cond_length_mm numeric,
  tubo_cond_in numeric,
  tubo_cond_mm numeric,
  esp_tubo_cond_mm numeric,
  geometria_condensador text,
  volume_interno_condensador_l numeric,
  ventilador_condensador text,
  vazao_ventilador_condensador_m3h numeric,

  -- Evaporador (43-48)
  evap_rows integer,
  evap_tubes_per_row integer,
  evap_circuits integer,
  evap_fin_spacing_mm numeric,
  evap_length_mm numeric,
  evap_rows_2 integer,
  geometria_evaporador text,

  -- Reaquecimento (50-56)
  reaq_tubes_per_row integer,
  reaq_circuits integer,
  reaq_fin_spacing_mm numeric,
  reaq_length_mm numeric,
  tubo_evap_in numeric,
  tubo_evap_mm numeric,
  esp_tubo_evap_mm numeric,
  geometria_reaquecimento text,

  -- Volumes / áreas / ventilação evaporador (58-62)
  volume_interno_evaporador_l numeric,
  area_superficie_troca_evaporador_m2 numeric,
  quantidade_reaquecimentos integer,
  ventilador_reaquecimento text,
  vazao_ventilador_evaporador_m3h numeric,

  -- Condições operacionais (63-75)
  temperatura_camara_c numeric,
  umidade_camara_pct numeric,
  temperatura_evaporacao_c numeric,
  temperatura_condensacao_c numeric,
  temperatura_externa_c numeric,
  umidade_externa_pct numeric,
  vazao_massa_kgh numeric,
  vazao_massa_kgs numeric,
  diferenca_entalpia_kjkg numeric,
  superaquecimento_total_k numeric,
  superaquecimento_util_k numeric,
  subresfriamento_k numeric,
  subresfriamento_adicional_k numeric,
  altitude_m numeric,

  -- Linhas de refrigerante (76-81)
  linha_de_descarga text,
  velocidade_linha_descarga_ms numeric,
  linha_de_liquido text,
  velocidade_linha_liquido_ms numeric,
  linha_de_succao text,
  velocidade_linha_succao_ms numeric,

  -- Carga, água, drenos (82-85)
  carga_de_fluido_kg numeric,
  quantidade_agua_produzida_lh numeric,
  diametro_dreno text,
  quantidade_drenos integer,

  -- Potências e correntes (86-94)
  potencia_elet_compressor_kw numeric,
  potencia_elet_ventilador_kw numeric,
  potencia_elet_total_kw numeric,
  cop_kw_kw numeric,
  cop_carnot_kk numeric,
  corrente_elet_compressor_a numeric,
  corrente_elet_ventiladores_a numeric,
  corrente_elet_estimada_a numeric,
  corrente_elet_partida_a numeric,

  -- Circuito secundário (95-115)
  modelo_condensador_secundario text,
  ventilador_condensador_secundario text,
  vazao_ventilador_condensador_secundario_m3h numeric,
  modelo_trocador_de_calor text,
  capacidade_frig_requisitada_kcalh numeric,
  capacidade_frig_compressor_sec_kcalh numeric,
  calor_rejeitado_secundario_kcalh numeric,
  temperatura_entrada_c numeric,
  temperatura_saida_c numeric,
  temperatura_evaporacao_secundario_c numeric,
  temperatura_condensacao_secundario_c numeric,
  superaquecimento_total_secundario_k numeric,
  superaquecimento_util_secundario_k numeric,
  subresfriamento_secundario_k numeric,
  potencia_elet_compressor_secundario_kw numeric,
  potencia_elet_ventilador_secundario_kw numeric,
  potencia_elet_total_secundario_kw numeric,
  cop_secundario_kw_kw numeric,
  cop_carnot_secundario_kk numeric,
  corrente_elet_compressor_secundario_a numeric,
  corrente_elet_ventiladores_secundario_a numeric,
  corrente_elet_estimada_secundario_a numeric,
  corrente_elet_partida_secundario_a numeric,

  -- Extras / observações
  raw_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text
);

CREATE INDEX idx_cn_equipment_catalog_modelo ON public.cn_equipment_catalog(modelo);
CREATE INDEX idx_cn_equipment_catalog_modelo_unico ON public.cn_equipment_catalog(modelo_unico);
CREATE INDEX idx_cn_equipment_catalog_fabricante ON public.cn_equipment_catalog(fabricante);
CREATE INDEX idx_cn_equipment_catalog_refrigerante ON public.cn_equipment_catalog(refrigerante);

ALTER TABLE public.cn_equipment_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "CNEC: auth select" ON public.cn_equipment_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "CNEC: auth insert" ON public.cn_equipment_catalog
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "CNEC: auth update" ON public.cn_equipment_catalog
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "CNEC: admin delete" ON public.cn_equipment_catalog
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_cn_equipment_catalog_updated_at
  BEFORE UPDATE ON public.cn_equipment_catalog
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();