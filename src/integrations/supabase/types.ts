export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      coil_calibrations: {
        Row: {
          air_dp_correction_factor: number
          calibration_name: string | null
          capacity_correction_factor: number
          coil_type: string
          component_item_id: string
          confidence_score: number
          correlation_set_version: string
          created_at: string
          created_by: string | null
          deviation_after: Json
          deviation_before: Json
          engine: string
          engine_name: string
          engine_version: string
          heat_transfer_factor: number
          id: string
          inputs_snapshot: Json
          is_active: boolean
          meets_targets: boolean
          model_signature: string | null
          notes: string | null
          outputs_snapshot: Json
          ref_dp_correction_factor: number
          reference_json: Json
          reference_source: string | null
          result_after_json: Json
          result_before_json: Json
          status: string
          ua_correction_factor: number
        }
        Insert: {
          air_dp_correction_factor?: number
          calibration_name?: string | null
          capacity_correction_factor?: number
          coil_type: string
          component_item_id: string
          confidence_score?: number
          correlation_set_version?: string
          created_at?: string
          created_by?: string | null
          deviation_after?: Json
          deviation_before?: Json
          engine?: string
          engine_name?: string
          engine_version?: string
          heat_transfer_factor?: number
          id?: string
          inputs_snapshot?: Json
          is_active?: boolean
          meets_targets?: boolean
          model_signature?: string | null
          notes?: string | null
          outputs_snapshot?: Json
          ref_dp_correction_factor?: number
          reference_json?: Json
          reference_source?: string | null
          result_after_json?: Json
          result_before_json?: Json
          status?: string
          ua_correction_factor?: number
        }
        Update: {
          air_dp_correction_factor?: number
          calibration_name?: string | null
          capacity_correction_factor?: number
          coil_type?: string
          component_item_id?: string
          confidence_score?: number
          correlation_set_version?: string
          created_at?: string
          created_by?: string | null
          deviation_after?: Json
          deviation_before?: Json
          engine?: string
          engine_name?: string
          engine_version?: string
          heat_transfer_factor?: number
          id?: string
          inputs_snapshot?: Json
          is_active?: boolean
          meets_targets?: boolean
          model_signature?: string | null
          notes?: string | null
          outputs_snapshot?: Json
          ref_dp_correction_factor?: number
          reference_json?: Json
          reference_source?: string | null
          result_after_json?: Json
          result_before_json?: Json
          status?: string
          ua_correction_factor?: number
        }
        Relationships: []
      }
      coil_correlations: {
        Row: {
          application: string | null
          created_at: string
          fluid_side: string | null
          geometry_type: string | null
          group_name: string | null
          id: string
          name: string
          phase: string | null
          raw_json: Json
          updated_at: string
          validity_range_json: Json
          wet_mode: string | null
        }
        Insert: {
          application?: string | null
          created_at?: string
          fluid_side?: string | null
          geometry_type?: string | null
          group_name?: string | null
          id?: string
          name: string
          phase?: string | null
          raw_json?: Json
          updated_at?: string
          validity_range_json?: Json
          wet_mode?: string | null
        }
        Update: {
          application?: string | null
          created_at?: string
          fluid_side?: string | null
          geometry_type?: string | null
          group_name?: string | null
          id?: string
          name?: string
          phase?: string | null
          raw_json?: Json
          updated_at?: string
          validity_range_json?: Json
          wet_mode?: string | null
        }
        Relationships: []
      }
      coil_factor_application_logs: {
        Row: {
          base_result_json: Json
          component_item_id: string | null
          created_at: string
          created_by: string | null
          engine: string
          equipment_project_id: string | null
          factors_json: Json
          final_result_json: Json
          geometry_factor_id: string | null
          id: string
          mode: string | null
        }
        Insert: {
          base_result_json?: Json
          component_item_id?: string | null
          created_at?: string
          created_by?: string | null
          engine: string
          equipment_project_id?: string | null
          factors_json?: Json
          final_result_json?: Json
          geometry_factor_id?: string | null
          id?: string
          mode?: string | null
        }
        Update: {
          base_result_json?: Json
          component_item_id?: string | null
          created_at?: string
          created_by?: string | null
          engine?: string
          equipment_project_id?: string | null
          factors_json?: Json
          final_result_json?: Json
          geometry_factor_id?: string | null
          id?: string
          mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "coil_factor_application_logs_geometry_factor_id_fkey"
            columns: ["geometry_factor_id"]
            isOneToOne: false
            referencedRelation: "coil_geometry_factors"
            referencedColumns: ["id"]
          },
        ]
      }
      coil_fluids: {
        Row: {
          approval_status: Database["public"]["Enums"]["technical_record_status"]
          created_at: string
          critical_pressure_bar: number | null
          critical_temp_c: number | null
          family: string | null
          fluid_type: string
          gwp: number | null
          id: string
          latent_heat_kj_kg: number | null
          liquid_conductivity_w_mk: number | null
          liquid_cp_kj_kgk: number | null
          liquid_density_kg_m3: number | null
          liquid_viscosity_upa_s: number | null
          molar_mass_g_mol: number | null
          name: string
          notes: string | null
          reference_temp_c: number | null
          updated_at: string
          vapour_cp_kj_kgk: number | null
          vapour_density_kg_m3: number | null
          vapour_viscosity_upa_s: number | null
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          created_at?: string
          critical_pressure_bar?: number | null
          critical_temp_c?: number | null
          family?: string | null
          fluid_type: string
          gwp?: number | null
          id?: string
          latent_heat_kj_kg?: number | null
          liquid_conductivity_w_mk?: number | null
          liquid_cp_kj_kgk?: number | null
          liquid_density_kg_m3?: number | null
          liquid_viscosity_upa_s?: number | null
          molar_mass_g_mol?: number | null
          name: string
          notes?: string | null
          reference_temp_c?: number | null
          updated_at?: string
          vapour_cp_kj_kgk?: number | null
          vapour_density_kg_m3?: number | null
          vapour_viscosity_upa_s?: number | null
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          created_at?: string
          critical_pressure_bar?: number | null
          critical_temp_c?: number | null
          family?: string | null
          fluid_type?: string
          gwp?: number | null
          id?: string
          latent_heat_kj_kg?: number | null
          liquid_conductivity_w_mk?: number | null
          liquid_cp_kj_kgk?: number | null
          liquid_density_kg_m3?: number | null
          liquid_viscosity_upa_s?: number | null
          molar_mass_g_mol?: number | null
          name?: string
          notes?: string | null
          reference_temp_c?: number | null
          updated_at?: string
          vapour_cp_kj_kgk?: number | null
          vapour_density_kg_m3?: number | null
          vapour_viscosity_upa_s?: number | null
        }
        Relationships: []
      }
      coil_geometry_factors: {
        Row: {
          battery_code: string | null
          created_at: string
          description: string | null
          factor_a0: number | null
          factor_a1: number | null
          factor_a2: number | null
          factor_fatc: number | null
          fat_coef_lato_tubo: number | null
          fat_cor_al: number | null
          fat_corr_fat_attr: number | null
          fat_rid_aum_sup: number | null
          fatt_pdc_concentrate: number | null
          fattore_attr_aria: number | null
          fattore_attr_aria_latente: number | null
          fin_height_mm: number | null
          fin_thickness_mm: number | null
          fin_type: string | null
          geometry_code: string
          id: string
          import_batch_id: string | null
          mode: string
          raw_json: Json
          rid_area_pass_tubo: number | null
          row_spacing_mm: number | null
          security_factor: number | null
          sigla: string | null
          slope_fat_coef_lato_tubo: number | null
          slope_fat_cor_al: number | null
          slope_fat_corr_fat_attr: number | null
          slope_fattore_attr_aria: number | null
          source_row_hash: string | null
          source_table: string
          tube_arrangement: string | null
          tube_height_mm: number | null
          tube_outer_diameter_mm: number | null
          tube_shape: string | null
          tube_spacing_mm: number | null
          tube_thickness_mm: number | null
          tube_type: string | null
          tube_width_mm: number | null
          updated_at: string
        }
        Insert: {
          battery_code?: string | null
          created_at?: string
          description?: string | null
          factor_a0?: number | null
          factor_a1?: number | null
          factor_a2?: number | null
          factor_fatc?: number | null
          fat_coef_lato_tubo?: number | null
          fat_cor_al?: number | null
          fat_corr_fat_attr?: number | null
          fat_rid_aum_sup?: number | null
          fatt_pdc_concentrate?: number | null
          fattore_attr_aria?: number | null
          fattore_attr_aria_latente?: number | null
          fin_height_mm?: number | null
          fin_thickness_mm?: number | null
          fin_type?: string | null
          geometry_code: string
          id?: string
          import_batch_id?: string | null
          mode: string
          raw_json?: Json
          rid_area_pass_tubo?: number | null
          row_spacing_mm?: number | null
          security_factor?: number | null
          sigla?: string | null
          slope_fat_coef_lato_tubo?: number | null
          slope_fat_cor_al?: number | null
          slope_fat_corr_fat_attr?: number | null
          slope_fattore_attr_aria?: number | null
          source_row_hash?: string | null
          source_table: string
          tube_arrangement?: string | null
          tube_height_mm?: number | null
          tube_outer_diameter_mm?: number | null
          tube_shape?: string | null
          tube_spacing_mm?: number | null
          tube_thickness_mm?: number | null
          tube_type?: string | null
          tube_width_mm?: number | null
          updated_at?: string
        }
        Update: {
          battery_code?: string | null
          created_at?: string
          description?: string | null
          factor_a0?: number | null
          factor_a1?: number | null
          factor_a2?: number | null
          factor_fatc?: number | null
          fat_coef_lato_tubo?: number | null
          fat_cor_al?: number | null
          fat_corr_fat_attr?: number | null
          fat_rid_aum_sup?: number | null
          fatt_pdc_concentrate?: number | null
          fattore_attr_aria?: number | null
          fattore_attr_aria_latente?: number | null
          fin_height_mm?: number | null
          fin_thickness_mm?: number | null
          fin_type?: string | null
          geometry_code?: string
          id?: string
          import_batch_id?: string | null
          mode?: string
          raw_json?: Json
          rid_area_pass_tubo?: number | null
          row_spacing_mm?: number | null
          security_factor?: number | null
          sigla?: string | null
          slope_fat_coef_lato_tubo?: number | null
          slope_fat_cor_al?: number | null
          slope_fat_corr_fat_attr?: number | null
          slope_fattore_attr_aria?: number | null
          source_row_hash?: string | null
          source_table?: string
          tube_arrangement?: string | null
          tube_height_mm?: number | null
          tube_outer_diameter_mm?: number | null
          tube_shape?: string | null
          tube_spacing_mm?: number | null
          tube_thickness_mm?: number | null
          tube_type?: string | null
          tube_width_mm?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "coil_geometry_factors_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "unilab_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      coil_materials: {
        Row: {
          category: string
          created_at: string
          density_kg_m3: number | null
          id: string
          name: string
          notes: string | null
          roughness_mm: number | null
          thermal_conductivity_w_mk: number
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          density_kg_m3?: number | null
          id?: string
          name: string
          notes?: string | null
          roughness_mm?: number | null
          thermal_conductivity_w_mk: number
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          density_kg_m3?: number | null
          id?: string
          name?: string
          notes?: string | null
          roughness_mm?: number | null
          thermal_conductivity_w_mk?: number
          updated_at?: string
        }
        Relationships: []
      }
      coil_performance_maps: {
        Row: {
          calibration_id: string | null
          coil_type: string
          component_item_id: string
          confidence_score: number
          created_at: string
          created_by: string | null
          engine: string
          equipment_project_id: string | null
          id: string
          input_grid_json: Json
          is_estimated: boolean
          map_name: string | null
          notes: string | null
          results_json: Json
          status: string
          summary_json: Json
        }
        Insert: {
          calibration_id?: string | null
          coil_type: string
          component_item_id: string
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          engine?: string
          equipment_project_id?: string | null
          id?: string
          input_grid_json?: Json
          is_estimated?: boolean
          map_name?: string | null
          notes?: string | null
          results_json?: Json
          status?: string
          summary_json?: Json
        }
        Update: {
          calibration_id?: string | null
          coil_type?: string
          component_item_id?: string
          confidence_score?: number
          created_at?: string
          created_by?: string | null
          engine?: string
          equipment_project_id?: string | null
          id?: string
          input_grid_json?: Json
          is_estimated?: boolean
          map_name?: string | null
          notes?: string | null
          results_json?: Json
          status?: string
          summary_json?: Json
        }
        Relationships: []
      }
      coil_simulations: {
        Row: {
          coil_type: string | null
          component_item_id: string | null
          created_at: string
          created_by: string | null
          equipment_project_id: string | null
          id: string
          inputs: Json
          label: string | null
          mode: string
          outputs: Json
          warnings: Json
        }
        Insert: {
          coil_type?: string | null
          component_item_id?: string | null
          created_at?: string
          created_by?: string | null
          equipment_project_id?: string | null
          id?: string
          inputs?: Json
          label?: string | null
          mode?: string
          outputs?: Json
          warnings?: Json
        }
        Update: {
          coil_type?: string | null
          component_item_id?: string | null
          created_at?: string
          created_by?: string | null
          equipment_project_id?: string | null
          id?: string
          inputs?: Json
          label?: string | null
          mode?: string
          outputs?: Json
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "coil_simulations_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: false
            referencedRelation: "component_items"
            referencedColumns: ["id"]
          },
        ]
      }
      component_files: {
        Row: {
          component_item_id: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          uploaded_at: string
          uploaded_by: string | null
        }
        Insert: {
          component_item_id: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Update: {
          component_item_id?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          uploaded_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "component_files_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: false
            referencedRelation: "component_items"
            referencedColumns: ["id"]
          },
        ]
      }
      component_items: {
        Row: {
          code: string | null
          created_at: string
          created_by: string | null
          description: string | null
          equipment_project_id: string
          id: string
          kind: Database["public"]["Enums"]["component_kind"]
          manufacturer: string | null
          model: string | null
          raw_fields: Json
          status: Database["public"]["Enums"]["component_status"]
          updated_at: string
          validated_fields: Json
        }
        Insert: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_project_id: string
          id?: string
          kind: Database["public"]["Enums"]["component_kind"]
          manufacturer?: string | null
          model?: string | null
          raw_fields?: Json
          status?: Database["public"]["Enums"]["component_status"]
          updated_at?: string
          validated_fields?: Json
        }
        Update: {
          code?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          equipment_project_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["component_kind"]
          manufacturer?: string | null
          model?: string | null
          raw_fields?: Json
          status?: Database["public"]["Enums"]["component_status"]
          updated_at?: string
          validated_fields?: Json
        }
        Relationships: [
          {
            foreignKeyName: "component_items_equipment_project_id_fkey"
            columns: ["equipment_project_id"]
            isOneToOne: false
            referencedRelation: "equipment_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      compressor_models: {
        Row: {
          application_type: string | null
          approval_status: Database["public"]["Enums"]["technical_record_status"]
          compressor_type: string | null
          created_at: string
          displacement: number | null
          frequency: string | null
          frequency_hz: number | null
          id: string
          manufacturer: string | null
          massflow_correction: number | null
          model: string
          model_standard: string | null
          motor_efficiency: number | null
          phase: number | null
          power_correction: number | null
          raw_json: Json
          refrigerant: string | null
          rpm: number | null
          source_db: string | null
          source_table_key: string | null
          subcooling_k: number | null
          superheat_k: number | null
          temp_cond_max_c: number | null
          temp_cond_min_c: number | null
          temp_evap_max_c: number | null
          temp_evap_min_c: number | null
          units_system: string | null
          updated_at: string
          vapcyc_batch_id: string | null
          voltage: string | null
          voltage_v: number | null
        }
        Insert: {
          application_type?: string | null
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          compressor_type?: string | null
          created_at?: string
          displacement?: number | null
          frequency?: string | null
          frequency_hz?: number | null
          id?: string
          manufacturer?: string | null
          massflow_correction?: number | null
          model: string
          model_standard?: string | null
          motor_efficiency?: number | null
          phase?: number | null
          power_correction?: number | null
          raw_json?: Json
          refrigerant?: string | null
          rpm?: number | null
          source_db?: string | null
          source_table_key?: string | null
          subcooling_k?: number | null
          superheat_k?: number | null
          temp_cond_max_c?: number | null
          temp_cond_min_c?: number | null
          temp_evap_max_c?: number | null
          temp_evap_min_c?: number | null
          units_system?: string | null
          updated_at?: string
          vapcyc_batch_id?: string | null
          voltage?: string | null
          voltage_v?: number | null
        }
        Update: {
          application_type?: string | null
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          compressor_type?: string | null
          created_at?: string
          displacement?: number | null
          frequency?: string | null
          frequency_hz?: number | null
          id?: string
          manufacturer?: string | null
          massflow_correction?: number | null
          model?: string
          model_standard?: string | null
          motor_efficiency?: number | null
          phase?: number | null
          power_correction?: number | null
          raw_json?: Json
          refrigerant?: string | null
          rpm?: number | null
          source_db?: string | null
          source_table_key?: string | null
          subcooling_k?: number | null
          superheat_k?: number | null
          temp_cond_max_c?: number | null
          temp_cond_min_c?: number | null
          temp_evap_max_c?: number | null
          temp_evap_min_c?: number | null
          units_system?: string | null
          updated_at?: string
          vapcyc_batch_id?: string | null
          voltage?: string | null
          voltage_v?: number | null
        }
        Relationships: []
      }
      compressor_polynomials: {
        Row: {
          coefficients_json: Json
          compressor_id: string | null
          created_at: string
          curve_type: string
          id: string
          raw_json: Json
          temp_cond_max_c: number | null
          temp_cond_min_c: number | null
          temp_evap_max_c: number | null
          temp_evap_min_c: number | null
          unit_system: string | null
        }
        Insert: {
          coefficients_json?: Json
          compressor_id?: string | null
          created_at?: string
          curve_type: string
          id?: string
          raw_json?: Json
          temp_cond_max_c?: number | null
          temp_cond_min_c?: number | null
          temp_evap_max_c?: number | null
          temp_evap_min_c?: number | null
          unit_system?: string | null
        }
        Update: {
          coefficients_json?: Json
          compressor_id?: string | null
          created_at?: string
          curve_type?: string
          id?: string
          raw_json?: Json
          temp_cond_max_c?: number | null
          temp_cond_min_c?: number | null
          temp_evap_max_c?: number | null
          temp_evap_min_c?: number | null
          unit_system?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "compressor_polynomials_compressor_id_fkey"
            columns: ["compressor_id"]
            isOneToOne: false
            referencedRelation: "compressor_models"
            referencedColumns: ["id"]
          },
        ]
      }
      condenser_coil_models: {
        Row: {
          air_density_in_kg_m3: number | null
          air_mass_flow_kgh: number | null
          air_pressure_drop_pa: number | null
          altitude_m: number | null
          approval_status: Database["public"]["Enums"]["technical_record_status"]
          atm_pressure_bar: number | null
          circuits: number | null
          component_item_id: string
          confidence_score: number | null
          created_at: string
          delta_t_log_k: number | null
          description: string | null
          desuperheat_k: number | null
          enthalpy_in_kjkg: number | null
          enthalpy_out_kjkg: number | null
          exponent_n: number
          face_velocity_ms: number | null
          field_sources: Json
          fin_material: string | null
          fin_pitch_mm: number | null
          fin_thickness_mm: number | null
          frontal_area_m2: number | null
          global_coeff_w: number | null
          id: string
          internal_volume_l: number | null
          length_mm: number | null
          liquid_velocity_ms: number | null
          manifold_pressure_drop_kpa: number | null
          manual_overrides: Json
          mass_velocity_kg_m2s: number | null
          missing_fields: Json
          nominal_air_temp_in_c: number | null
          nominal_air_temp_out_c: number | null
          nominal_airflow_m3h: number | null
          nominal_capacity_w: number | null
          nominal_cond_temp_c: number | null
          raw_fields: Json
          refrigerant: string | null
          refrigerant_mass_flow_kgh: number | null
          refrigerant_pressure_drop_kpa: number | null
          rh_in_pct: number | null
          rh_out_pct: number | null
          rows: number | null
          sensible_ratio: number | null
          spec_hum_in_g_kg: number | null
          spec_hum_out_g_kg: number | null
          subcooling_k: number | null
          surface_area_m2: number | null
          total_ref_pressure_drop_kpa: number | null
          tube_id_mm: number | null
          tube_material: string | null
          tube_od_mm: number | null
          tube_shape: string | null
          tubes_per_row: number | null
          updated_at: string
          validation_report: Json
          vapour_velocity_ms: number | null
        }
        Insert: {
          air_density_in_kg_m3?: number | null
          air_mass_flow_kgh?: number | null
          air_pressure_drop_pa?: number | null
          altitude_m?: number | null
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          atm_pressure_bar?: number | null
          circuits?: number | null
          component_item_id: string
          confidence_score?: number | null
          created_at?: string
          delta_t_log_k?: number | null
          description?: string | null
          desuperheat_k?: number | null
          enthalpy_in_kjkg?: number | null
          enthalpy_out_kjkg?: number | null
          exponent_n?: number
          face_velocity_ms?: number | null
          field_sources?: Json
          fin_material?: string | null
          fin_pitch_mm?: number | null
          fin_thickness_mm?: number | null
          frontal_area_m2?: number | null
          global_coeff_w?: number | null
          id?: string
          internal_volume_l?: number | null
          length_mm?: number | null
          liquid_velocity_ms?: number | null
          manifold_pressure_drop_kpa?: number | null
          manual_overrides?: Json
          mass_velocity_kg_m2s?: number | null
          missing_fields?: Json
          nominal_air_temp_in_c?: number | null
          nominal_air_temp_out_c?: number | null
          nominal_airflow_m3h?: number | null
          nominal_capacity_w?: number | null
          nominal_cond_temp_c?: number | null
          raw_fields?: Json
          refrigerant?: string | null
          refrigerant_mass_flow_kgh?: number | null
          refrigerant_pressure_drop_kpa?: number | null
          rh_in_pct?: number | null
          rh_out_pct?: number | null
          rows?: number | null
          sensible_ratio?: number | null
          spec_hum_in_g_kg?: number | null
          spec_hum_out_g_kg?: number | null
          subcooling_k?: number | null
          surface_area_m2?: number | null
          total_ref_pressure_drop_kpa?: number | null
          tube_id_mm?: number | null
          tube_material?: string | null
          tube_od_mm?: number | null
          tube_shape?: string | null
          tubes_per_row?: number | null
          updated_at?: string
          validation_report?: Json
          vapour_velocity_ms?: number | null
        }
        Update: {
          air_density_in_kg_m3?: number | null
          air_mass_flow_kgh?: number | null
          air_pressure_drop_pa?: number | null
          altitude_m?: number | null
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          atm_pressure_bar?: number | null
          circuits?: number | null
          component_item_id?: string
          confidence_score?: number | null
          created_at?: string
          delta_t_log_k?: number | null
          description?: string | null
          desuperheat_k?: number | null
          enthalpy_in_kjkg?: number | null
          enthalpy_out_kjkg?: number | null
          exponent_n?: number
          face_velocity_ms?: number | null
          field_sources?: Json
          fin_material?: string | null
          fin_pitch_mm?: number | null
          fin_thickness_mm?: number | null
          frontal_area_m2?: number | null
          global_coeff_w?: number | null
          id?: string
          internal_volume_l?: number | null
          length_mm?: number | null
          liquid_velocity_ms?: number | null
          manifold_pressure_drop_kpa?: number | null
          manual_overrides?: Json
          mass_velocity_kg_m2s?: number | null
          missing_fields?: Json
          nominal_air_temp_in_c?: number | null
          nominal_air_temp_out_c?: number | null
          nominal_airflow_m3h?: number | null
          nominal_capacity_w?: number | null
          nominal_cond_temp_c?: number | null
          raw_fields?: Json
          refrigerant?: string | null
          refrigerant_mass_flow_kgh?: number | null
          refrigerant_pressure_drop_kpa?: number | null
          rh_in_pct?: number | null
          rh_out_pct?: number | null
          rows?: number | null
          sensible_ratio?: number | null
          spec_hum_in_g_kg?: number | null
          spec_hum_out_g_kg?: number | null
          subcooling_k?: number | null
          surface_area_m2?: number | null
          total_ref_pressure_drop_kpa?: number | null
          tube_id_mm?: number | null
          tube_material?: string | null
          tube_od_mm?: number | null
          tube_shape?: string | null
          tubes_per_row?: number | null
          updated_at?: string
          validation_report?: Json
          vapour_velocity_ms?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "condenser_coil_models_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: true
            referencedRelation: "component_items"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_projects: {
        Row: {
          application: Database["public"]["Enums"]["equipment_application"]
          code: string
          commercial_name: string
          created_at: string
          created_by: string | null
          equipment_kind: Database["public"]["Enums"]["equipment_kind"]
          family: string | null
          id: string
          notes: string | null
          refrigerant: string | null
          status: Database["public"]["Enums"]["equipment_project_status"]
          target_capacity: number | null
          target_temperature: number | null
          updated_at: string
        }
        Insert: {
          application?: Database["public"]["Enums"]["equipment_application"]
          code: string
          commercial_name: string
          created_at?: string
          created_by?: string | null
          equipment_kind?: Database["public"]["Enums"]["equipment_kind"]
          family?: string | null
          id?: string
          notes?: string | null
          refrigerant?: string | null
          status?: Database["public"]["Enums"]["equipment_project_status"]
          target_capacity?: number | null
          target_temperature?: number | null
          updated_at?: string
        }
        Update: {
          application?: Database["public"]["Enums"]["equipment_application"]
          code?: string
          commercial_name?: string
          created_at?: string
          created_by?: string | null
          equipment_kind?: Database["public"]["Enums"]["equipment_kind"]
          family?: string | null
          id?: string
          notes?: string | null
          refrigerant?: string | null
          status?: Database["public"]["Enums"]["equipment_project_status"]
          target_capacity?: number | null
          target_temperature?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      equipment_simulations: {
        Row: {
          created_at: string
          created_by: string | null
          equipment_project_id: string
          id: string
          inputs: Json
          outputs: Json
          warnings: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          equipment_project_id: string
          id?: string
          inputs?: Json
          outputs?: Json
          warnings?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          equipment_project_id?: string
          id?: string
          inputs?: Json
          outputs?: Json
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "equipment_simulations_equipment_project_id_fkey"
            columns: ["equipment_project_id"]
            isOneToOne: false
            referencedRelation: "equipment_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      evaporator_coil_models: {
        Row: {
          air_density_in_kg_m3: number | null
          air_pressure_drop_pa: number | null
          altitude_m: number | null
          approval_status: Database["public"]["Enums"]["technical_record_status"]
          atm_pressure_bar: number | null
          circuits: number | null
          component_item_id: string
          confidence_score: number | null
          created_at: string
          delta_h_log_kjkg: number | null
          description: string | null
          enthalpy_in_kjkg: number | null
          enthalpy_out_kjkg: number | null
          exponent_n: number
          face_velocity_ms: number | null
          field_sources: Json
          fin_material: string | null
          fin_pitch_mm: number | null
          fin_thickness_mm: number | null
          frontal_area_m2: number | null
          global_coeff_w: number | null
          id: string
          internal_volume_l: number | null
          length_mm: number | null
          liquid_velocity_ms: number | null
          manifold_pressure_drop_kpa: number | null
          manual_overrides: Json
          mass_velocity_kg_m2s: number | null
          missing_fields: Json
          nominal_air_mass_flow_kgh: number | null
          nominal_air_temp_in_c: number | null
          nominal_air_temp_out_c: number | null
          nominal_airflow_m3h: number | null
          nominal_capacity_w: number | null
          nominal_delta_t_k: number | null
          nominal_evap_temp_c: number | null
          nominal_latent_w: number | null
          nominal_sensible_w: number | null
          raw_fields: Json
          refrigerant: string | null
          refrigerant_mass_flow_kgh: number | null
          refrigerant_pressure_drop_kpa: number | null
          rh_in_pct: number | null
          rh_out_pct: number | null
          rows: number | null
          sensible_ratio: number | null
          spec_hum_in_g_kg: number | null
          spec_hum_out_g_kg: number | null
          subcooling_k: number | null
          superheat_k: number | null
          surface_area_m2: number | null
          total_ref_pressure_drop_kpa: number | null
          tube_id_mm: number | null
          tube_material: string | null
          tube_od_mm: number | null
          tube_shape: string | null
          tubes_per_row: number | null
          updated_at: string
          validation_report: Json
          vapour_velocity_ms: number | null
          water_production_kgh: number | null
        }
        Insert: {
          air_density_in_kg_m3?: number | null
          air_pressure_drop_pa?: number | null
          altitude_m?: number | null
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          atm_pressure_bar?: number | null
          circuits?: number | null
          component_item_id: string
          confidence_score?: number | null
          created_at?: string
          delta_h_log_kjkg?: number | null
          description?: string | null
          enthalpy_in_kjkg?: number | null
          enthalpy_out_kjkg?: number | null
          exponent_n?: number
          face_velocity_ms?: number | null
          field_sources?: Json
          fin_material?: string | null
          fin_pitch_mm?: number | null
          fin_thickness_mm?: number | null
          frontal_area_m2?: number | null
          global_coeff_w?: number | null
          id?: string
          internal_volume_l?: number | null
          length_mm?: number | null
          liquid_velocity_ms?: number | null
          manifold_pressure_drop_kpa?: number | null
          manual_overrides?: Json
          mass_velocity_kg_m2s?: number | null
          missing_fields?: Json
          nominal_air_mass_flow_kgh?: number | null
          nominal_air_temp_in_c?: number | null
          nominal_air_temp_out_c?: number | null
          nominal_airflow_m3h?: number | null
          nominal_capacity_w?: number | null
          nominal_delta_t_k?: number | null
          nominal_evap_temp_c?: number | null
          nominal_latent_w?: number | null
          nominal_sensible_w?: number | null
          raw_fields?: Json
          refrigerant?: string | null
          refrigerant_mass_flow_kgh?: number | null
          refrigerant_pressure_drop_kpa?: number | null
          rh_in_pct?: number | null
          rh_out_pct?: number | null
          rows?: number | null
          sensible_ratio?: number | null
          spec_hum_in_g_kg?: number | null
          spec_hum_out_g_kg?: number | null
          subcooling_k?: number | null
          superheat_k?: number | null
          surface_area_m2?: number | null
          total_ref_pressure_drop_kpa?: number | null
          tube_id_mm?: number | null
          tube_material?: string | null
          tube_od_mm?: number | null
          tube_shape?: string | null
          tubes_per_row?: number | null
          updated_at?: string
          validation_report?: Json
          vapour_velocity_ms?: number | null
          water_production_kgh?: number | null
        }
        Update: {
          air_density_in_kg_m3?: number | null
          air_pressure_drop_pa?: number | null
          altitude_m?: number | null
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          atm_pressure_bar?: number | null
          circuits?: number | null
          component_item_id?: string
          confidence_score?: number | null
          created_at?: string
          delta_h_log_kjkg?: number | null
          description?: string | null
          enthalpy_in_kjkg?: number | null
          enthalpy_out_kjkg?: number | null
          exponent_n?: number
          face_velocity_ms?: number | null
          field_sources?: Json
          fin_material?: string | null
          fin_pitch_mm?: number | null
          fin_thickness_mm?: number | null
          frontal_area_m2?: number | null
          global_coeff_w?: number | null
          id?: string
          internal_volume_l?: number | null
          length_mm?: number | null
          liquid_velocity_ms?: number | null
          manifold_pressure_drop_kpa?: number | null
          manual_overrides?: Json
          mass_velocity_kg_m2s?: number | null
          missing_fields?: Json
          nominal_air_mass_flow_kgh?: number | null
          nominal_air_temp_in_c?: number | null
          nominal_air_temp_out_c?: number | null
          nominal_airflow_m3h?: number | null
          nominal_capacity_w?: number | null
          nominal_delta_t_k?: number | null
          nominal_evap_temp_c?: number | null
          nominal_latent_w?: number | null
          nominal_sensible_w?: number | null
          raw_fields?: Json
          refrigerant?: string | null
          refrigerant_mass_flow_kgh?: number | null
          refrigerant_pressure_drop_kpa?: number | null
          rh_in_pct?: number | null
          rh_out_pct?: number | null
          rows?: number | null
          sensible_ratio?: number | null
          spec_hum_in_g_kg?: number | null
          spec_hum_out_g_kg?: number | null
          subcooling_k?: number | null
          superheat_k?: number | null
          surface_area_m2?: number | null
          total_ref_pressure_drop_kpa?: number | null
          tube_id_mm?: number | null
          tube_material?: string | null
          tube_od_mm?: number | null
          tube_shape?: string | null
          tubes_per_row?: number | null
          updated_at?: string
          validation_report?: Json
          vapour_velocity_ms?: number | null
          water_production_kgh?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "evaporator_coil_models_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: true
            referencedRelation: "component_items"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_curves: {
        Row: {
          coefficients_json: Json
          created_at: string
          curve_type: string
          fan_id: string | null
          id: string
          raw_json: Json
          table_data_json: Json
        }
        Insert: {
          coefficients_json?: Json
          created_at?: string
          curve_type: string
          fan_id?: string | null
          id?: string
          raw_json?: Json
          table_data_json?: Json
        }
        Update: {
          coefficients_json?: Json
          created_at?: string
          curve_type?: string
          fan_id?: string | null
          id?: string
          raw_json?: Json
          table_data_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "fan_curves_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "fan_models"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_models: {
        Row: {
          approval_status: Database["public"]["Enums"]["technical_record_status"]
          created_at: string
          diameter_mm: number | null
          fan_type: string | null
          id: string
          manufacturer: string | null
          model: string
          nominal_airflow_m3h: number | null
          nominal_power_w: number | null
          nominal_pressure_pa: number | null
          raw_json: Json
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          created_at?: string
          diameter_mm?: number | null
          fan_type?: string | null
          id?: string
          manufacturer?: string | null
          model: string
          nominal_airflow_m3h?: number | null
          nominal_power_w?: number | null
          nominal_pressure_pa?: number | null
          raw_json?: Json
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          created_at?: string
          diameter_mm?: number | null
          fan_type?: string | null
          id?: string
          manufacturer?: string | null
          model?: string
          nominal_airflow_m3h?: number | null
          nominal_power_w?: number | null
          nominal_pressure_pa?: number | null
          raw_json?: Json
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      refrigerant_polynomials: {
        Row: {
          c0: number | null
          c1: number | null
          c2: number | null
          c3: number | null
          c4: number | null
          c5: number | null
          c6: number | null
          created_at: string
          id: string
          phase: string | null
          property_id: string | null
          property_name: string
          raw_json: Json
          refrigerant_code: string | null
          refrigerant_id: string | null
          temp_max_c: number | null
          temp_min_c: number | null
          unit: string | null
        }
        Insert: {
          c0?: number | null
          c1?: number | null
          c2?: number | null
          c3?: number | null
          c4?: number | null
          c5?: number | null
          c6?: number | null
          created_at?: string
          id?: string
          phase?: string | null
          property_id?: string | null
          property_name: string
          raw_json?: Json
          refrigerant_code?: string | null
          refrigerant_id?: string | null
          temp_max_c?: number | null
          temp_min_c?: number | null
          unit?: string | null
        }
        Update: {
          c0?: number | null
          c1?: number | null
          c2?: number | null
          c3?: number | null
          c4?: number | null
          c5?: number | null
          c6?: number | null
          created_at?: string
          id?: string
          phase?: string | null
          property_id?: string | null
          property_name?: string
          raw_json?: Json
          refrigerant_code?: string | null
          refrigerant_id?: string | null
          temp_max_c?: number | null
          temp_min_c?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "refrigerant_polynomials_refrigerant_id_fkey"
            columns: ["refrigerant_id"]
            isOneToOne: false
            referencedRelation: "refrigerants"
            referencedColumns: ["id"]
          },
        ]
      }
      refrigerants: {
        Row: {
          approval_status: Database["public"]["Enums"]["technical_record_status"]
          code: string
          created_at: string
          family: string | null
          gwp: number | null
          id: string
          name: string | null
          odp: number | null
          raw_json: Json
          safety_class: string | null
          type: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          code: string
          created_at?: string
          family?: string | null
          gwp?: number | null
          id?: string
          name?: string | null
          odp?: number | null
          raw_json?: Json
          safety_class?: string | null
          type?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          code?: string
          created_at?: string
          family?: string | null
          gwp?: number | null
          id?: string
          name?: string | null
          odp?: number | null
          raw_json?: Json
          safety_class?: string | null
          type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      technical_components: {
        Row: {
          application: string | null
          approved_at: string | null
          approved_by: string | null
          code: string | null
          compatible_refrigerants_json: Json
          context: string
          created_at: string
          entity_type: Database["public"]["Enums"]["technical_entity_type"]
          family: string | null
          id: string
          manufacturer: string | null
          model: string | null
          normalized_json: Json
          notes: string | null
          source: string | null
          source_batch_id: string | null
          source_mapped_id: string | null
          source_raw_id: string | null
          status: Database["public"]["Enums"]["technical_record_status"]
          updated_at: string
        }
        Insert: {
          application?: string | null
          approved_at?: string | null
          approved_by?: string | null
          code?: string | null
          compatible_refrigerants_json?: Json
          context?: string
          created_at?: string
          entity_type: Database["public"]["Enums"]["technical_entity_type"]
          family?: string | null
          id?: string
          manufacturer?: string | null
          model?: string | null
          normalized_json?: Json
          notes?: string | null
          source?: string | null
          source_batch_id?: string | null
          source_mapped_id?: string | null
          source_raw_id?: string | null
          status?: Database["public"]["Enums"]["technical_record_status"]
          updated_at?: string
        }
        Update: {
          application?: string | null
          approved_at?: string | null
          approved_by?: string | null
          code?: string | null
          compatible_refrigerants_json?: Json
          context?: string
          created_at?: string
          entity_type?: Database["public"]["Enums"]["technical_entity_type"]
          family?: string | null
          id?: string
          manufacturer?: string | null
          model?: string | null
          normalized_json?: Json
          notes?: string | null
          source?: string | null
          source_batch_id?: string | null
          source_mapped_id?: string | null
          source_raw_id?: string | null
          status?: Database["public"]["Enums"]["technical_record_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "technical_components_source_batch_id_fkey"
            columns: ["source_batch_id"]
            isOneToOne: false
            referencedRelation: "technical_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_components_source_mapped_id_fkey"
            columns: ["source_mapped_id"]
            isOneToOne: false
            referencedRelation: "technical_mapped_records"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_components_source_raw_id_fkey"
            columns: ["source_raw_id"]
            isOneToOne: false
            referencedRelation: "technical_raw_records"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_import_batches: {
        Row: {
          approved_rows: number
          created_at: string
          created_by: string | null
          errors_json: Json
          file_name: string | null
          id: string
          manufacturer: string | null
          mapped_rows: number
          notes: string | null
          source_name: string
          source_type: string | null
          status: Database["public"]["Enums"]["technical_batch_status"]
          summary_json: Json
          total_files: number
          total_rows: number
          updated_at: string
          validated_rows: number
        }
        Insert: {
          approved_rows?: number
          created_at?: string
          created_by?: string | null
          errors_json?: Json
          file_name?: string | null
          id?: string
          manufacturer?: string | null
          mapped_rows?: number
          notes?: string | null
          source_name: string
          source_type?: string | null
          status?: Database["public"]["Enums"]["technical_batch_status"]
          summary_json?: Json
          total_files?: number
          total_rows?: number
          updated_at?: string
          validated_rows?: number
        }
        Update: {
          approved_rows?: number
          created_at?: string
          created_by?: string | null
          errors_json?: Json
          file_name?: string | null
          id?: string
          manufacturer?: string | null
          mapped_rows?: number
          notes?: string | null
          source_name?: string
          source_type?: string | null
          status?: Database["public"]["Enums"]["technical_batch_status"]
          summary_json?: Json
          total_files?: number
          total_rows?: number
          updated_at?: string
          validated_rows?: number
        }
        Relationships: []
      }
      technical_mapped_records: {
        Row: {
          approved_component_id: string | null
          batch_id: string
          code: string | null
          confidence_score: number
          created_at: string
          entity_type: Database["public"]["Enums"]["technical_entity_type"]
          id: string
          manufacturer: string | null
          mapper_name: string | null
          mapping_status: Database["public"]["Enums"]["technical_record_status"]
          model: string | null
          normalized_json: Json
          raw_record_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          updated_at: string
          validation_errors_json: Json
        }
        Insert: {
          approved_component_id?: string | null
          batch_id: string
          code?: string | null
          confidence_score?: number
          created_at?: string
          entity_type: Database["public"]["Enums"]["technical_entity_type"]
          id?: string
          manufacturer?: string | null
          mapper_name?: string | null
          mapping_status?: Database["public"]["Enums"]["technical_record_status"]
          model?: string | null
          normalized_json?: Json
          raw_record_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          validation_errors_json?: Json
        }
        Update: {
          approved_component_id?: string | null
          batch_id?: string
          code?: string | null
          confidence_score?: number
          created_at?: string
          entity_type?: Database["public"]["Enums"]["technical_entity_type"]
          id?: string
          manufacturer?: string | null
          mapper_name?: string | null
          mapping_status?: Database["public"]["Enums"]["technical_record_status"]
          model?: string | null
          normalized_json?: Json
          raw_record_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          updated_at?: string
          validation_errors_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "technical_mapped_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "technical_import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "technical_mapped_records_raw_record_id_fkey"
            columns: ["raw_record_id"]
            isOneToOne: false
            referencedRelation: "technical_raw_records"
            referencedColumns: ["id"]
          },
        ]
      }
      technical_raw_records: {
        Row: {
          batch_id: string
          created_at: string
          detected_entity_type: Database["public"]["Enums"]["technical_entity_type"]
          detected_manufacturer: string | null
          id: string
          notes: string | null
          raw_json: Json
          row_index: number | null
          source_file: string | null
          source_table: string | null
          status: Database["public"]["Enums"]["technical_record_status"]
        }
        Insert: {
          batch_id: string
          created_at?: string
          detected_entity_type?: Database["public"]["Enums"]["technical_entity_type"]
          detected_manufacturer?: string | null
          id?: string
          notes?: string | null
          raw_json?: Json
          row_index?: number | null
          source_file?: string | null
          source_table?: string | null
          status?: Database["public"]["Enums"]["technical_record_status"]
        }
        Update: {
          batch_id?: string
          created_at?: string
          detected_entity_type?: Database["public"]["Enums"]["technical_entity_type"]
          detected_manufacturer?: string | null
          id?: string
          notes?: string | null
          raw_json?: Json
          row_index?: number | null
          source_file?: string | null
          source_table?: string | null
          status?: Database["public"]["Enums"]["technical_record_status"]
        }
        Relationships: [
          {
            foreignKeyName: "technical_raw_records_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "technical_import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      unilab_extractions: {
        Row: {
          component_file_id: string | null
          component_item_id: string
          created_at: string
          created_by: string | null
          extracted_fields: Json
          id: string
          parser: string
          raw_preview: string | null
          success: boolean
          warnings: Json
        }
        Insert: {
          component_file_id?: string | null
          component_item_id: string
          created_at?: string
          created_by?: string | null
          extracted_fields?: Json
          id?: string
          parser: string
          raw_preview?: string | null
          success?: boolean
          warnings?: Json
        }
        Update: {
          component_file_id?: string | null
          component_item_id?: string
          created_at?: string
          created_by?: string | null
          extracted_fields?: Json
          id?: string
          parser?: string
          raw_preview?: string | null
          success?: boolean
          warnings?: Json
        }
        Relationships: [
          {
            foreignKeyName: "unilab_extractions_component_file_id_fkey"
            columns: ["component_file_id"]
            isOneToOne: false
            referencedRelation: "component_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "unilab_extractions_component_item_id_fkey"
            columns: ["component_item_id"]
            isOneToOne: false
            referencedRelation: "component_items"
            referencedColumns: ["id"]
          },
        ]
      }
      unilab_geometries: {
        Row: {
          approval_status: Database["public"]["Enums"]["technical_record_status"]
          circuits: number | null
          created_at: string
          description: string | null
          fin_pitch_mm: number | null
          fin_thickness_mm: number | null
          fin_type: string | null
          geometry_code: string
          id: string
          import_batch_id: string | null
          mode: string
          raw_json: Json
          row_pitch_mm: number | null
          rows: number | null
          source_table: string | null
          tube_inner_diameter_mm: number | null
          tube_outer_diameter_mm: number | null
          tube_pitch_mm: number | null
          tube_type: string | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          circuits?: number | null
          created_at?: string
          description?: string | null
          fin_pitch_mm?: number | null
          fin_thickness_mm?: number | null
          fin_type?: string | null
          geometry_code: string
          id?: string
          import_batch_id?: string | null
          mode: string
          raw_json?: Json
          row_pitch_mm?: number | null
          rows?: number | null
          source_table?: string | null
          tube_inner_diameter_mm?: number | null
          tube_outer_diameter_mm?: number | null
          tube_pitch_mm?: number | null
          tube_type?: string | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          circuits?: number | null
          created_at?: string
          description?: string | null
          fin_pitch_mm?: number | null
          fin_thickness_mm?: number | null
          fin_type?: string | null
          geometry_code?: string
          id?: string
          import_batch_id?: string | null
          mode?: string
          raw_json?: Json
          row_pitch_mm?: number | null
          rows?: number | null
          source_table?: string | null
          tube_inner_diameter_mm?: number | null
          tube_outer_diameter_mm?: number | null
          tube_pitch_mm?: number | null
          tube_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unilab_geometries_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "unilab_import_batches_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      unilab_geometries_factors: {
        Row: {
          approval_status: Database["public"]["Enums"]["technical_record_status"]
          created_at: string
          factor_a0: number | null
          factor_a1: number | null
          factor_a2: number | null
          factor_fatc: number | null
          fat_coef_lattub: number | null
          fat_cor_al: number | null
          fat_corr_fat_attr: number | null
          fat_rid_aum_sup: number | null
          fattore_attr_aria: number | null
          fattore_attr_aria_latente: number | null
          geometry_code: string
          id: string
          import_batch_id: string | null
          mode: string
          raw_json: Json
          security_factor: number | null
          slope_fat_coef_lattub: number | null
          slope_fat_cor_al: number | null
          slope_fattore_attr_aria: number | null
          updated_at: string
        }
        Insert: {
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          created_at?: string
          factor_a0?: number | null
          factor_a1?: number | null
          factor_a2?: number | null
          factor_fatc?: number | null
          fat_coef_lattub?: number | null
          fat_cor_al?: number | null
          fat_corr_fat_attr?: number | null
          fat_rid_aum_sup?: number | null
          fattore_attr_aria?: number | null
          fattore_attr_aria_latente?: number | null
          geometry_code: string
          id?: string
          import_batch_id?: string | null
          mode: string
          raw_json?: Json
          security_factor?: number | null
          slope_fat_coef_lattub?: number | null
          slope_fat_cor_al?: number | null
          slope_fattore_attr_aria?: number | null
          updated_at?: string
        }
        Update: {
          approval_status?: Database["public"]["Enums"]["technical_record_status"]
          created_at?: string
          factor_a0?: number | null
          factor_a1?: number | null
          factor_a2?: number | null
          factor_fatc?: number | null
          fat_coef_lattub?: number | null
          fat_cor_al?: number | null
          fat_corr_fat_attr?: number | null
          fat_rid_aum_sup?: number | null
          fattore_attr_aria?: number | null
          fattore_attr_aria_latente?: number | null
          geometry_code?: string
          id?: string
          import_batch_id?: string | null
          mode?: string
          raw_json?: Json
          security_factor?: number | null
          slope_fat_coef_lattub?: number | null
          slope_fat_cor_al?: number | null
          slope_fattore_attr_aria?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unilab_geometries_factors_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "unilab_import_batches_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      unilab_import_batches: {
        Row: {
          id: string
          imported_at: string
          imported_by: string | null
          notes: string | null
          source_hash: string | null
          source_name: string
          source_version: string | null
        }
        Insert: {
          id?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          source_hash?: string | null
          source_name?: string
          source_version?: string | null
        }
        Update: {
          id?: string
          imported_at?: string
          imported_by?: string | null
          notes?: string | null
          source_hash?: string | null
          source_name?: string
          source_version?: string | null
        }
        Relationships: []
      }
      unilab_import_batches_v2: {
        Row: {
          created_at: string
          created_by: string | null
          errors_json: Json
          finished_at: string | null
          id: string
          notes: string | null
          source_file: string
          source_version: string | null
          started_at: string
          status: string
          summary_json: Json
          total_rows: number
          total_tables: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          errors_json?: Json
          finished_at?: string | null
          id?: string
          notes?: string | null
          source_file: string
          source_version?: string | null
          started_at?: string
          status?: string
          summary_json?: Json
          total_rows?: number
          total_tables?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          errors_json?: Json
          finished_at?: string | null
          id?: string
          notes?: string | null
          source_file?: string
          source_version?: string | null
          started_at?: string
          status?: string
          summary_json?: Json
          total_rows?: number
          total_tables?: number
          updated_at?: string
        }
        Relationships: []
      }
      unilab_raw_tables: {
        Row: {
          created_at: string
          id: string
          import_batch_id: string
          raw_json: Json
          row_index: number
          source_table: string
        }
        Insert: {
          created_at?: string
          id?: string
          import_batch_id: string
          raw_json?: Json
          row_index: number
          source_table: string
        }
        Update: {
          created_at?: string
          id?: string
          import_batch_id?: string
          raw_json?: Json
          row_index?: number
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "unilab_raw_tables_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "unilab_import_batches_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      unilab_source_files: {
        Row: {
          column_count: number
          content_hash: string | null
          created_at: string
          file_kind: string
          headers_json: Json
          id: string
          import_batch_id: string | null
          notes: string | null
          row_count: number
          sheet_name: string | null
          source_database: string
          source_path: string
          source_table: string
          status: string
          updated_at: string
        }
        Insert: {
          column_count?: number
          content_hash?: string | null
          created_at?: string
          file_kind?: string
          headers_json?: Json
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          row_count?: number
          sheet_name?: string | null
          source_database: string
          source_path: string
          source_table: string
          status?: string
          updated_at?: string
        }
        Update: {
          column_count?: number
          content_hash?: string | null
          created_at?: string
          file_kind?: string
          headers_json?: Json
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          row_count?: number
          sheet_name?: string | null
          source_database?: string
          source_path?: string
          source_table?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "unilab_source_files_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "unilab_import_batches_v2"
            referencedColumns: ["id"]
          },
        ]
      }
      unilab_source_rows: {
        Row: {
          created_at: string
          id: string
          raw_json: Json
          row_index: number
          source_file_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          raw_json?: Json
          row_index: number
          source_file_id: string
        }
        Update: {
          created_at?: string
          id?: string
          raw_json?: Json
          row_index?: number
          source_file_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "unilab_source_rows_source_file_id_fkey"
            columns: ["source_file_id"]
            isOneToOne: false
            referencedRelation: "unilab_source_files"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vapcyc_cycle_templates: {
        Row: {
          components_json: Json
          created_at: string
          cycle_name: string | null
          cycle_type: string | null
          id: string
          raw_json: Json
          source_db: string | null
          vapcyc_batch_id: string | null
        }
        Insert: {
          components_json?: Json
          created_at?: string
          cycle_name?: string | null
          cycle_type?: string | null
          id?: string
          raw_json?: Json
          source_db?: string | null
          vapcyc_batch_id?: string | null
        }
        Update: {
          components_json?: Json
          created_at?: string
          cycle_name?: string | null
          cycle_type?: string | null
          id?: string
          raw_json?: Json
          source_db?: string | null
          vapcyc_batch_id?: string | null
        }
        Relationships: []
      }
      vapcyc_import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          errors_json: Json
          finished_at: string | null
          id: string
          source_zip: string | null
          started_at: string
          status: string
          summary_json: Json
          total_cycles: number
          total_fans: number
          total_models: number
          total_polynomials: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          errors_json?: Json
          finished_at?: string | null
          id?: string
          source_zip?: string | null
          started_at?: string
          status?: string
          summary_json?: Json
          total_cycles?: number
          total_fans?: number
          total_models?: number
          total_polynomials?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          errors_json?: Json
          finished_at?: string | null
          id?: string
          source_zip?: string | null
          started_at?: string
          status?: string
          summary_json?: Json
          total_cycles?: number
          total_fans?: number
          total_models?: number
          total_polynomials?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "engenheiro"
      component_kind:
        | "evaporador"
        | "condensador"
        | "compressor"
        | "ventilador"
        | "valvula_expansao"
        | "separador_liquido"
        | "acumulador"
        | "painel_eletrico"
        | "controlador"
        | "outro"
      component_status:
        | "draft"
        | "imported"
        | "simulated"
        | "validated"
        | "approved"
        | "needs_review"
      equipment_application:
        | "resfriamento"
        | "congelamento"
        | "conservacao"
        | "processo_industrial"
        | "climatizacao_industrial"
        | "outro"
      equipment_kind:
        | "plugin"
        | "split"
        | "rack"
        | "chiller"
        | "tunel_congelamento"
        | "camara_fria"
        | "unidade_condensadora"
        | "unidade_evaporadora"
        | "outro"
      equipment_project_status:
        | "draft"
        | "in_progress"
        | "validated"
        | "archived"
      technical_batch_status:
        | "pending"
        | "processing"
        | "mapped"
        | "partially_validated"
        | "completed"
        | "failed"
      technical_entity_type:
        | "compressor"
        | "fan"
        | "expansion_valve"
        | "solenoid_valve"
        | "hot_gas_valve"
        | "condenser_coil"
        | "evaporator_coil"
        | "refrigerant"
        | "fluid"
        | "controller"
        | "sensor"
        | "accessory"
        | "unknown"
      technical_file_category:
        | "ficha_tecnica"
        | "laudo_teste"
        | "planilha_calculo"
        | "curva_compressor"
        | "catalogo_fornecedor"
        | "desenho_tecnico"
        | "imagem"
        | "outro"
      technical_file_group:
        | "evaporador"
        | "condensador"
        | "compressor"
        | "laudos"
        | "planilhas"
        | "curvas"
        | "imagens"
        | "documentos"
        | "outros"
      technical_record_status:
        | "raw_imported"
        | "mapped"
        | "needs_review"
        | "validated"
        | "approved"
        | "rejected"
        | "unmapped"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "engenheiro"],
      component_kind: [
        "evaporador",
        "condensador",
        "compressor",
        "ventilador",
        "valvula_expansao",
        "separador_liquido",
        "acumulador",
        "painel_eletrico",
        "controlador",
        "outro",
      ],
      component_status: [
        "draft",
        "imported",
        "simulated",
        "validated",
        "approved",
        "needs_review",
      ],
      equipment_application: [
        "resfriamento",
        "congelamento",
        "conservacao",
        "processo_industrial",
        "climatizacao_industrial",
        "outro",
      ],
      equipment_kind: [
        "plugin",
        "split",
        "rack",
        "chiller",
        "tunel_congelamento",
        "camara_fria",
        "unidade_condensadora",
        "unidade_evaporadora",
        "outro",
      ],
      equipment_project_status: [
        "draft",
        "in_progress",
        "validated",
        "archived",
      ],
      technical_batch_status: [
        "pending",
        "processing",
        "mapped",
        "partially_validated",
        "completed",
        "failed",
      ],
      technical_entity_type: [
        "compressor",
        "fan",
        "expansion_valve",
        "solenoid_valve",
        "hot_gas_valve",
        "condenser_coil",
        "evaporator_coil",
        "refrigerant",
        "fluid",
        "controller",
        "sensor",
        "accessory",
        "unknown",
      ],
      technical_file_category: [
        "ficha_tecnica",
        "laudo_teste",
        "planilha_calculo",
        "curva_compressor",
        "catalogo_fornecedor",
        "desenho_tecnico",
        "imagem",
        "outro",
      ],
      technical_file_group: [
        "evaporador",
        "condensador",
        "compressor",
        "laudos",
        "planilhas",
        "curvas",
        "imagens",
        "documentos",
        "outros",
      ],
      technical_record_status: [
        "raw_imported",
        "mapped",
        "needs_review",
        "validated",
        "approved",
        "rejected",
        "unmapped",
      ],
    },
  },
} as const
