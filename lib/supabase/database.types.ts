
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "access_plans": {
                  Row: {
                    "all_courses": boolean,"created_at": string,"duration_days": number,"id": string,"is_active": boolean,"is_beta": boolean,"is_lifetime": boolean,"name": string,"price_eur": number,"slug": string
                  }
                  ComputedFields: never
                  Insert: {
                    "all_courses"?: boolean,"created_at"?: string,"duration_days": number,"id"?: string,"is_active"?: boolean,"is_beta"?: boolean,"is_lifetime"?: boolean,"name": string,"price_eur"?: number,"slug": string
                  }
                  Update: {
                    "all_courses"?: boolean,"created_at"?: string,"duration_days"?: number,"id"?: string,"is_active"?: boolean,"is_beta"?: boolean,"is_lifetime"?: boolean,"name"?: string,"price_eur"?: number,"slug"?: string
                  }
                  Relationships: [
                    
                  ]
                },"enrollments": {
                  Row: {
                    "created_at": string,"expires_at": string,"id": string,"plan_id": string,"revoked_at": string | null,"source": Database["public"]['Enums']["enrollment_source"],"starts_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"expires_at": string,"id"?: string,"plan_id": string,"revoked_at"?: string | null,"source": Database["public"]['Enums']["enrollment_source"],"starts_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"id"?: string,"plan_id"?: string,"revoked_at"?: string | null,"source"?: Database["public"]['Enums']["enrollment_source"],"starts_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "access_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"feedback": {
                  Row: {
                    "created_at": string,"id": string,"message": string,"page": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"message": string,"page": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"message"?: string,"page"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"invites": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"email": string,"email_sent_at": string | null,"expires_at": string,"full_name": string,"id": string,"invited_by": string | null,"plan_id": string,"revoked_at": string | null,"token_hash": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email": string,"email_sent_at"?: string | null,"expires_at"?: string,"full_name"?: string,"id"?: string,"invited_by"?: string | null,"plan_id": string,"revoked_at"?: string | null,"token_hash": string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"email"?: string,"email_sent_at"?: string | null,"expires_at"?: string,"full_name"?: string,"id"?: string,"invited_by"?: string | null,"plan_id"?: string,"revoked_at"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invites_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "access_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"login_link_requests": {
                  Row: {
                    "created_at": string,"email_hash": string,"id": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"email_hash": string,"id"?: never
                  }
                  Update: {
                    "created_at"?: string,"email_hash"?: string,"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"modules": {
                  Row: {
                    "created_at": string,"description": string,"id": string,"is_published": boolean,"slug": string,"sort_order": number,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"description"?: string,"id"?: string,"is_published"?: boolean,"slug": string,"sort_order"?: number,"title": string
                  }
                  Update: {
                    "created_at"?: string,"description"?: string,"id"?: string,"is_published"?: boolean,"slug"?: string,"sort_order"?: number,"title"?: string
                  }
                  Relationships: [
                    
                  ]
                },"plan_courses": {
                  Row: {
                    "module_id": string,"plan_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "module_id": string,"plan_id": string
                  }
                  Update: {
                    "module_id"?: string,"plan_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "plan_courses_module_id_fkey"
      columns: ["module_id"]
isOneToOne: false
      referencedRelation: "modules"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "plan_courses_plan_id_fkey"
      columns: ["plan_id"]
isOneToOne: false
      referencedRelation: "access_plans"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"full_name": string,"id": string,"role": Database["public"]['Enums']["user_role"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"full_name"?: string,"id": string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Update: {
                    "created_at"?: string,"full_name"?: string,"id"?: string,"role"?: Database["public"]['Enums']["user_role"]
                  }
                  Relationships: [
                    
                  ]
                },"user_settings": {
                  Row: {
                    "font_size": number,"intro_dismissed": NonNullable<Json>,"marketing_consent": boolean,"reader_mode": string,"reminders_enabled": boolean,"terms_accepted_at": string | null,"theme": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "font_size"?: number,"intro_dismissed"?: NonNullable<Json>,"marketing_consent"?: boolean,"reader_mode"?: string,"reminders_enabled"?: boolean,"terms_accepted_at"?: string | null,"theme"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "font_size"?: number,"intro_dismissed"?: NonNullable<Json>,"marketing_consent"?: boolean,"reader_mode"?: string,"reminders_enabled"?: boolean,"terms_accepted_at"?: string | null,"theme"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "has_module_access":
{ Args: { "target_module": string }; Returns: boolean
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           }
          }
          Enums: {
            "enrollment_source": "stripe"|"manual"|"invite"|"beta","user_role": "admin"|"student"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "enrollment_source": ["stripe", "manual", "invite", "beta"],"user_role": ["admin", "student"]
          }
        }
} as const
