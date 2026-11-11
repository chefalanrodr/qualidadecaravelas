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
      action_plans: {
        Row: {
          answer_id: string | null
          corrected_at: string | null
          created_at: string
          created_by: string | null
          description: string
          due_date: string | null
          id: string
          priority: string | null
          quality_answer_id: string | null
          quality_audit_id: string | null
          responsible: string | null
          responsible_user_id: string | null
          solution: string | null
          status: string
          updated_at: string
        }
        Insert: {
          answer_id?: string | null
          corrected_at?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          due_date?: string | null
          id?: string
          priority?: string | null
          quality_answer_id?: string | null
          quality_audit_id?: string | null
          responsible?: string | null
          responsible_user_id?: string | null
          solution?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          answer_id?: string | null
          corrected_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          due_date?: string | null
          id?: string
          priority?: string | null
          quality_answer_id?: string | null
          quality_audit_id?: string | null
          responsible?: string | null
          responsible_user_id?: string | null
          solution?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "checklist_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_quality_answer_id_fkey"
            columns: ["quality_answer_id"]
            isOneToOne: false
            referencedRelation: "quality_audit_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "action_plans_quality_audit_id_fkey"
            columns: ["quality_audit_id"]
            isOneToOne: false
            referencedRelation: "quality_audits"
            referencedColumns: ["id"]
          },
        ]
      }
      areas: {
        Row: {
          created_at: string
          id: string
          name: string
          sector_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          sector_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          sector_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "areas_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      attachments: {
        Row: {
          action_plan_id: string | null
          answer_id: string | null
          created_at: string
          created_by: string | null
          id: string
          kind: string
          quality_answer_id: string | null
          storage_path: string
        }
        Insert: {
          action_plan_id?: string | null
          answer_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          quality_answer_id?: string | null
          storage_path: string
        }
        Update: {
          action_plan_id?: string | null
          answer_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          quality_answer_id?: string | null
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "attachments_action_plan_id_fkey"
            columns: ["action_plan_id"]
            isOneToOne: false
            referencedRelation: "action_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_answer_id_fkey"
            columns: ["answer_id"]
            isOneToOne: false
            referencedRelation: "checklist_answers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attachments_quality_answer_id_fkey"
            columns: ["quality_answer_id"]
            isOneToOne: false
            referencedRelation: "quality_audit_answers"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_answers: {
        Row: {
          answered_at: string
          answered_by: string | null
          created_at: string
          execution_id: string
          id: string
          item_id: string
          justification: string | null
          observation: string | null
          status: string
          updated_at: string
        }
        Insert: {
          answered_at?: string
          answered_by?: string | null
          created_at?: string
          execution_id: string
          id?: string
          item_id: string
          justification?: string | null
          observation?: string | null
          status: string
          updated_at?: string
        }
        Update: {
          answered_at?: string
          answered_by?: string | null
          created_at?: string
          execution_id?: string
          id?: string
          item_id?: string
          justification?: string | null
          observation?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_answers_execution_id_fkey"
            columns: ["execution_id"]
            isOneToOne: false
            referencedRelation: "checklist_executions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checklist_answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "checklist_items"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_executions: {
        Row: {
          auditor_id: string | null
          created_at: string
          finished_at: string | null
          id: string
          score: number | null
          started_at: string
          status: string
          template_id: string
          updated_at: string
        }
        Insert: {
          auditor_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          score?: number | null
          started_at?: string
          status?: string
          template_id: string
          updated_at?: string
        }
        Update: {
          auditor_id?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          score?: number | null
          started_at?: string
          status?: string
          template_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_executions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_items: {
        Row: {
          allow_not_applicable: boolean
          created_at: string
          evidence_hints: string[] | null
          goal_value: string | null
          guidance: string | null
          has_goal: boolean
          id: string
          is_critical: boolean
          is_required: boolean
          position: number
          priority: string
          requires_photo_on_conforme: boolean
          template_id: string
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          allow_not_applicable?: boolean
          created_at?: string
          evidence_hints?: string[] | null
          goal_value?: string | null
          guidance?: string | null
          has_goal?: boolean
          id?: string
          is_critical?: boolean
          is_required?: boolean
          position?: number
          priority?: string
          requires_photo_on_conforme?: boolean
          template_id: string
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          allow_not_applicable?: boolean
          created_at?: string
          evidence_hints?: string[] | null
          goal_value?: string | null
          guidance?: string | null
          has_goal?: boolean
          id?: string
          is_critical?: boolean
          is_required?: boolean
          position?: number
          priority?: string
          requires_photo_on_conforme?: boolean
          template_id?: string
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "checklist_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "checklist_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      checklist_templates: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          kind: string
          name: string
          schedule_days: Json | null
          sector_id: string | null
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name: string
          schedule_days?: Json | null
          sector_id?: string | null
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          kind?: string
          name?: string
          schedule_days?: Json | null
          sector_id?: string | null
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "checklist_templates_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string | null
          id: string
          role_label: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string | null
          id: string
          role_label?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string | null
          id?: string
          role_label?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      quality_areas: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          slug: string
          target_score: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          slug: string
          target_score?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          slug?: string
          target_score?: number
          updated_at?: string
        }
        Relationships: []
      }
      quality_audit_answers: {
        Row: {
          answer: string
          audit_id: string
          created_at: string
          id: string
          item_id: string
          justification: string | null
          observation: string | null
          photo_url: string | null
          sector_id: string
          updated_at: string
        }
        Insert: {
          answer: string
          audit_id: string
          created_at?: string
          id?: string
          item_id: string
          justification?: string | null
          observation?: string | null
          photo_url?: string | null
          sector_id: string
          updated_at?: string
        }
        Update: {
          answer?: string
          audit_id?: string
          created_at?: string
          id?: string
          item_id?: string
          justification?: string | null
          observation?: string | null
          photo_url?: string | null
          sector_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_audit_answers_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "quality_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audit_answers_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "quality_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audit_answers_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "quality_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audit_sectors: {
        Row: {
          audit_id: string
          conform: number
          created_at: string
          id: string
          na: number
          non_conform: number
          score: number
          sector_id: string
          total_items: number
          updated_at: string
        }
        Insert: {
          audit_id: string
          conform?: number
          created_at?: string
          id?: string
          na?: number
          non_conform?: number
          score?: number
          sector_id: string
          total_items?: number
          updated_at?: string
        }
        Update: {
          audit_id?: string
          conform?: number
          created_at?: string
          id?: string
          na?: number
          non_conform?: number
          score?: number
          sector_id?: string
          total_items?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_audit_sectors_audit_id_fkey"
            columns: ["audit_id"]
            isOneToOne: false
            referencedRelation: "quality_audits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quality_audit_sectors_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "quality_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_audits: {
        Row: {
          auditor_id: string | null
          auditor_signature: string | null
          created_at: string
          finished_at: string | null
          id: string
          iso_week: number
          iso_year: number
          month: number | null
          score: number | null
          started_at: string
          status: string
          updated_at: string
          week_of_month: number | null
          year: number | null
        }
        Insert: {
          auditor_id?: string | null
          auditor_signature?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          iso_week: number
          iso_year: number
          month?: number | null
          score?: number | null
          started_at?: string
          status?: string
          updated_at?: string
          week_of_month?: number | null
          year?: number | null
        }
        Update: {
          auditor_id?: string | null
          auditor_signature?: string | null
          created_at?: string
          finished_at?: string | null
          id?: string
          iso_week?: number
          iso_year?: number
          month?: number | null
          score?: number | null
          started_at?: string
          status?: string
          updated_at?: string
          week_of_month?: number | null
          year?: number | null
        }
        Relationships: []
      }
      quality_items: {
        Row: {
          created_at: string
          guidance: string | null
          id: string
          is_active: boolean
          is_critical: boolean
          position: number
          requires_photo: boolean
          score_sector_id: string | null
          sector_id: string
          title: string
          updated_at: string
          weight: number
        }
        Insert: {
          created_at?: string
          guidance?: string | null
          id?: string
          is_active?: boolean
          is_critical?: boolean
          position?: number
          requires_photo?: boolean
          score_sector_id?: string | null
          sector_id: string
          title: string
          updated_at?: string
          weight?: number
        }
        Update: {
          created_at?: string
          guidance?: string | null
          id?: string
          is_active?: boolean
          is_critical?: boolean
          position?: number
          requires_photo?: boolean
          score_sector_id?: string | null
          sector_id?: string
          title?: string
          updated_at?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "quality_items_sector_id_fkey"
            columns: ["sector_id"]
            isOneToOne: false
            referencedRelation: "quality_sectors"
            referencedColumns: ["id"]
          },
        ]
      }
      quality_sectors: {
        Row: {
          area_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          position: number
          slug: string
          target_score: number
          updated_at: string
        }
        Insert: {
          area_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          position?: number
          slug: string
          target_score?: number
          updated_at?: string
        }
        Update: {
          area_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          position?: number
          slug?: string
          target_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quality_sectors_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "quality_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      restaurant_settings: {
        Row: {
          created_at: string
          greeting: string | null
          id: number
          logo_url: string | null
          name: string
          score_bands: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          greeting?: string | null
          id: number
          logo_url?: string | null
          name?: string
          score_bands?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          greeting?: string | null
          id?: number
          logo_url?: string | null
          name?: string
          score_bands?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      sectors: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
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
      app_role: "admin" | "gestor" | "auditor" | "operador"
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
      app_role: ["admin", "gestor", "auditor", "operador"],
    },
  },
} as const
