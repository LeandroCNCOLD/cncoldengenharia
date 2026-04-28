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
      coil_simulations: {
        Row: {
          component_item_id: string
          created_at: string
          created_by: string | null
          id: string
          inputs: Json
          outputs: Json
          warnings: Json
        }
        Insert: {
          component_item_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inputs?: Json
          outputs?: Json
          warnings?: Json
        }
        Update: {
          component_item_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inputs?: Json
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
      condenser_coil_models: {
        Row: {
          circuits: number | null
          component_item_id: string
          created_at: string
          exponent_n: number
          fin_pitch_mm: number | null
          id: string
          internal_volume_l: number | null
          length_mm: number | null
          nominal_air_temp_in_c: number | null
          nominal_air_temp_out_c: number | null
          nominal_airflow_m3h: number | null
          nominal_capacity_w: number | null
          nominal_cond_temp_c: number | null
          raw_fields: Json
          refrigerant: string | null
          rows: number | null
          surface_area_m2: number | null
          tube_id_mm: number | null
          tube_od_mm: number | null
          tubes_per_row: number | null
          updated_at: string
        }
        Insert: {
          circuits?: number | null
          component_item_id: string
          created_at?: string
          exponent_n?: number
          fin_pitch_mm?: number | null
          id?: string
          internal_volume_l?: number | null
          length_mm?: number | null
          nominal_air_temp_in_c?: number | null
          nominal_air_temp_out_c?: number | null
          nominal_airflow_m3h?: number | null
          nominal_capacity_w?: number | null
          nominal_cond_temp_c?: number | null
          raw_fields?: Json
          refrigerant?: string | null
          rows?: number | null
          surface_area_m2?: number | null
          tube_id_mm?: number | null
          tube_od_mm?: number | null
          tubes_per_row?: number | null
          updated_at?: string
        }
        Update: {
          circuits?: number | null
          component_item_id?: string
          created_at?: string
          exponent_n?: number
          fin_pitch_mm?: number | null
          id?: string
          internal_volume_l?: number | null
          length_mm?: number | null
          nominal_air_temp_in_c?: number | null
          nominal_air_temp_out_c?: number | null
          nominal_airflow_m3h?: number | null
          nominal_capacity_w?: number | null
          nominal_cond_temp_c?: number | null
          raw_fields?: Json
          refrigerant?: string | null
          rows?: number | null
          surface_area_m2?: number | null
          tube_id_mm?: number | null
          tube_od_mm?: number | null
          tubes_per_row?: number | null
          updated_at?: string
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
          circuits: number | null
          component_item_id: string
          created_at: string
          exponent_n: number
          fin_pitch_mm: number | null
          id: string
          internal_volume_l: number | null
          length_mm: number | null
          nominal_air_temp_in_c: number | null
          nominal_air_temp_out_c: number | null
          nominal_airflow_m3h: number | null
          nominal_capacity_w: number | null
          nominal_evap_temp_c: number | null
          nominal_latent_w: number | null
          nominal_sensible_w: number | null
          raw_fields: Json
          refrigerant: string | null
          rows: number | null
          surface_area_m2: number | null
          tube_id_mm: number | null
          tube_od_mm: number | null
          tubes_per_row: number | null
          updated_at: string
        }
        Insert: {
          circuits?: number | null
          component_item_id: string
          created_at?: string
          exponent_n?: number
          fin_pitch_mm?: number | null
          id?: string
          internal_volume_l?: number | null
          length_mm?: number | null
          nominal_air_temp_in_c?: number | null
          nominal_air_temp_out_c?: number | null
          nominal_airflow_m3h?: number | null
          nominal_capacity_w?: number | null
          nominal_evap_temp_c?: number | null
          nominal_latent_w?: number | null
          nominal_sensible_w?: number | null
          raw_fields?: Json
          refrigerant?: string | null
          rows?: number | null
          surface_area_m2?: number | null
          tube_id_mm?: number | null
          tube_od_mm?: number | null
          tubes_per_row?: number | null
          updated_at?: string
        }
        Update: {
          circuits?: number | null
          component_item_id?: string
          created_at?: string
          exponent_n?: number
          fin_pitch_mm?: number | null
          id?: string
          internal_volume_l?: number | null
          length_mm?: number | null
          nominal_air_temp_in_c?: number | null
          nominal_air_temp_out_c?: number | null
          nominal_airflow_m3h?: number | null
          nominal_capacity_w?: number | null
          nominal_evap_temp_c?: number | null
          nominal_latent_w?: number | null
          nominal_sensible_w?: number | null
          raw_fields?: Json
          refrigerant?: string | null
          rows?: number | null
          surface_area_m2?: number | null
          tube_id_mm?: number | null
          tube_od_mm?: number | null
          tubes_per_row?: number | null
          updated_at?: string
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
    },
  },
} as const
