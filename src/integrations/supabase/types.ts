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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      itbi_import_log: {
        Row: {
          ano_referencia: number
          completed_at: string | null
          error_message: string | null
          id: string
          imported_by: string | null
          mes_referencia: number | null
          rows_imported: number
          rows_skipped: number
          source_url: string | null
          started_at: string
          status: string
        }
        Insert: {
          ano_referencia: number
          completed_at?: string | null
          error_message?: string | null
          id?: string
          imported_by?: string | null
          mes_referencia?: number | null
          rows_imported?: number
          rows_skipped?: number
          source_url?: string | null
          started_at?: string
          status?: string
        }
        Update: {
          ano_referencia?: number
          completed_at?: string | null
          error_message?: string | null
          id?: string
          imported_by?: string | null
          mes_referencia?: number | null
          rows_imported?: number
          rows_skipped?: number
          source_url?: string | null
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      itbi_transactions: {
        Row: {
          acc_iptu: string | null
          ano_referencia: number
          area_construida: number | null
          area_terreno: number | null
          bairro: string | null
          bairro_normalizado: string | null
          base_calculo: number | null
          cartorio_registro: string | null
          cep: string | null
          complemento: string | null
          created_at: string
          data_transacao: string | null
          descricao_padrao_iptu: string | null
          descricao_uso_iptu: string | null
          fracao_ideal: number | null
          id: string
          linha_hash: string | null
          logradouro: string
          logradouro_normalizado: string | null
          matricula_imovel: string | null
          mes_referencia: number
          natureza_transacao: string | null
          numero: string | null
          numero_limpo: string | null
          padrao_iptu: string | null
          proporcao_transmitida: number | null
          referencia: string | null
          situacao_sql: string | null
          sql_iptu: string | null
          testada: number | null
          tipo_financiamento: string | null
          uso_iptu: string | null
          valor_financiado: number | null
          valor_transacao: number | null
          valor_venal: number | null
          valor_venal_proporcional: number | null
        }
        Insert: {
          acc_iptu?: string | null
          ano_referencia: number
          area_construida?: number | null
          area_terreno?: number | null
          bairro?: string | null
          bairro_normalizado?: string | null
          base_calculo?: number | null
          cartorio_registro?: string | null
          cep?: string | null
          complemento?: string | null
          created_at?: string
          data_transacao?: string | null
          descricao_padrao_iptu?: string | null
          descricao_uso_iptu?: string | null
          fracao_ideal?: number | null
          id?: string
          linha_hash?: string | null
          logradouro: string
          logradouro_normalizado?: string | null
          matricula_imovel?: string | null
          mes_referencia: number
          natureza_transacao?: string | null
          numero?: string | null
          numero_limpo?: string | null
          padrao_iptu?: string | null
          proporcao_transmitida?: number | null
          referencia?: string | null
          situacao_sql?: string | null
          sql_iptu?: string | null
          testada?: number | null
          tipo_financiamento?: string | null
          uso_iptu?: string | null
          valor_financiado?: number | null
          valor_transacao?: number | null
          valor_venal?: number | null
          valor_venal_proporcional?: number | null
        }
        Update: {
          acc_iptu?: string | null
          ano_referencia?: number
          area_construida?: number | null
          area_terreno?: number | null
          bairro?: string | null
          bairro_normalizado?: string | null
          base_calculo?: number | null
          cartorio_registro?: string | null
          cep?: string | null
          complemento?: string | null
          created_at?: string
          data_transacao?: string | null
          descricao_padrao_iptu?: string | null
          descricao_uso_iptu?: string | null
          fracao_ideal?: number | null
          id?: string
          linha_hash?: string | null
          logradouro?: string
          logradouro_normalizado?: string | null
          matricula_imovel?: string | null
          mes_referencia?: number
          natureza_transacao?: string | null
          numero?: string | null
          numero_limpo?: string | null
          padrao_iptu?: string | null
          proporcao_transmitida?: number | null
          referencia?: string | null
          situacao_sql?: string | null
          sql_iptu?: string | null
          testada?: number | null
          tipo_financiamento?: string | null
          uso_iptu?: string | null
          valor_financiado?: number | null
          valor_transacao?: number | null
          valor_venal?: number | null
          valor_venal_proporcional?: number | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          ai_aluguel_max: number | null
          ai_aluguel_med: number | null
          ai_aluguel_min: number | null
          ai_market_estimate: string | null
          ai_market_estimate_updated_at: string | null
          ai_venda_max: number | null
          ai_venda_med: number | null
          ai_venda_min: number | null
          alugado: boolean | null
          ano_construcao: number | null
          apartamento: string | null
          area_comum: number | null
          area_total: number | null
          bairro: string
          banheiros: number | null
          cidade: string
          complemento: string | null
          created_at: string
          declared_value: number
          estado: string
          garagens: number | null
          id: string
          inquilino: string | null
          iptu_pago: boolean | null
          iptu_value: number | null
          latitude: number | null
          longitude: number | null
          market_value: number | null
          metragem: number | null
          numero: string | null
          numero_contribuinte: string | null
          numero_matricula: string | null
          observacao: string | null
          percentual_proprietario_matricula: number | null
          percentual_proprietario_matricula_ii: number | null
          photos: string[] | null
          proprietario_matricula: string | null
          proprietario_matricula_ii: string | null
          proprietario_papel: string | null
          quartos: number | null
          rua: string
          street_view_heading: number | null
          suites: number | null
          taxa_administracao: number | null
          tipo_imovel: string | null
          updated_at: string
          user_id: string | null
          validado: boolean | null
          valor_aluguel: number | null
          valor_condominio: number | null
          vendido: boolean | null
        }
        Insert: {
          ai_aluguel_max?: number | null
          ai_aluguel_med?: number | null
          ai_aluguel_min?: number | null
          ai_market_estimate?: string | null
          ai_market_estimate_updated_at?: string | null
          ai_venda_max?: number | null
          ai_venda_med?: number | null
          ai_venda_min?: number | null
          alugado?: boolean | null
          ano_construcao?: number | null
          apartamento?: string | null
          area_comum?: number | null
          area_total?: number | null
          bairro?: string
          banheiros?: number | null
          cidade?: string
          complemento?: string | null
          created_at?: string
          declared_value?: number
          estado?: string
          garagens?: number | null
          id?: string
          inquilino?: string | null
          iptu_pago?: boolean | null
          iptu_value?: number | null
          latitude?: number | null
          longitude?: number | null
          market_value?: number | null
          metragem?: number | null
          numero?: string | null
          numero_contribuinte?: string | null
          numero_matricula?: string | null
          observacao?: string | null
          percentual_proprietario_matricula?: number | null
          percentual_proprietario_matricula_ii?: number | null
          photos?: string[] | null
          proprietario_matricula?: string | null
          proprietario_matricula_ii?: string | null
          proprietario_papel?: string | null
          quartos?: number | null
          rua: string
          street_view_heading?: number | null
          suites?: number | null
          taxa_administracao?: number | null
          tipo_imovel?: string | null
          updated_at?: string
          user_id?: string | null
          validado?: boolean | null
          valor_aluguel?: number | null
          valor_condominio?: number | null
          vendido?: boolean | null
        }
        Update: {
          ai_aluguel_max?: number | null
          ai_aluguel_med?: number | null
          ai_aluguel_min?: number | null
          ai_market_estimate?: string | null
          ai_market_estimate_updated_at?: string | null
          ai_venda_max?: number | null
          ai_venda_med?: number | null
          ai_venda_min?: number | null
          alugado?: boolean | null
          ano_construcao?: number | null
          apartamento?: string | null
          area_comum?: number | null
          area_total?: number | null
          bairro?: string
          banheiros?: number | null
          cidade?: string
          complemento?: string | null
          created_at?: string
          declared_value?: number
          estado?: string
          garagens?: number | null
          id?: string
          inquilino?: string | null
          iptu_pago?: boolean | null
          iptu_value?: number | null
          latitude?: number | null
          longitude?: number | null
          market_value?: number | null
          metragem?: number | null
          numero?: string | null
          numero_contribuinte?: string | null
          numero_matricula?: string | null
          observacao?: string | null
          percentual_proprietario_matricula?: number | null
          percentual_proprietario_matricula_ii?: number | null
          photos?: string[] | null
          proprietario_matricula?: string | null
          proprietario_matricula_ii?: string | null
          proprietario_papel?: string | null
          quartos?: number | null
          rua?: string
          street_view_heading?: number | null
          suites?: number | null
          taxa_administracao?: number | null
          tipo_imovel?: string | null
          updated_at?: string
          user_id?: string | null
          validado?: boolean | null
          valor_aluguel?: number | null
          valor_condominio?: number | null
          vendido?: boolean | null
        }
        Relationships: []
      }
      property_balancete: {
        Row: {
          alugado: boolean | null
          aluguel: number | null
          ano: number
          apartamento: string | null
          bairro: string | null
          cidade: string | null
          complemento: string | null
          condominio: number | null
          cpf_locador: string | null
          created_at: string
          external_id: string | null
          id: string
          iptu: number | null
          liquido: number | null
          locatario: string | null
          mes: number
          numero: string | null
          outras_despesas: number | null
          periodo_contrato: string | null
          property_id: string | null
          reembolso_condominio: number | null
          reembolso_iptu: number | null
          reembolso_outras_despesas: number | null
          rua: string | null
          taxa_administracao: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          alugado?: boolean | null
          aluguel?: number | null
          ano: number
          apartamento?: string | null
          bairro?: string | null
          cidade?: string | null
          complemento?: string | null
          condominio?: number | null
          cpf_locador?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          iptu?: number | null
          liquido?: number | null
          locatario?: string | null
          mes: number
          numero?: string | null
          outras_despesas?: number | null
          periodo_contrato?: string | null
          property_id?: string | null
          reembolso_condominio?: number | null
          reembolso_iptu?: number | null
          reembolso_outras_despesas?: number | null
          rua?: string | null
          taxa_administracao?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          alugado?: boolean | null
          aluguel?: number | null
          ano?: number
          apartamento?: string | null
          bairro?: string | null
          cidade?: string | null
          complemento?: string | null
          condominio?: number | null
          cpf_locador?: string | null
          created_at?: string
          external_id?: string | null
          id?: string
          iptu?: number | null
          liquido?: number | null
          locatario?: string | null
          mes?: number
          numero?: string | null
          outras_despesas?: number | null
          periodo_contrato?: string | null
          property_id?: string | null
          reembolso_condominio?: number | null
          reembolso_iptu?: number | null
          reembolso_outras_despesas?: number | null
          rua?: string | null
          taxa_administracao?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_balancete_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      property_documents: {
        Row: {
          created_at: string
          document_type: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          property_id: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          document_type?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          property_id: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          document_type?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          property_id?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "property_documents_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
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
          role?: Database["public"]["Enums"]["app_role"]
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
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      match_itbi_candidates: {
        Args: {
          p_bairro?: string
          p_limit?: number
          p_logradouro: string
          p_numero?: string
        }
        Returns: {
          area_construida: number
          bairro: string
          cep: string
          complemento: string
          data_transacao: string
          id: string
          logradouro: string
          numero: string
          similarity_bairro: number
          similarity_logradouro: number
          sql_iptu: string
          valor_transacao: number
          valor_venal: number
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      normalize_address_text: { Args: { input: string }; Returns: string }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      unaccent: { Args: { "": string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "user"
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
      app_role: ["admin", "user"],
    },
  },
} as const
