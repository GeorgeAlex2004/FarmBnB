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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      bookings: {
        Row: {
          advance_paid: number | null
          allergies: string | null
          base_amount: number
          cancellation_reason: string | null
          check_in_date: string
          check_out_date: string
          created_at: string | null
          customer_id: string
          extra_fees: number | null
          food_preference: string | null
          food_required: boolean | null
          guest_charges: number | null
          guest_relations_call_completed_at: string | null
          guest_relations_call_completed_by: string | null
          guest_relations_call_status: string | null
          id: string
          id_proofs: string[] | null
          manual_reference: string | null
          num_guests: number
          payment_method: string | null
          payment_screenshot_url: string | null
          payment_status: string | null
          property_id: string
          special_requests: string | null
          status: string | null
          stripe_payment_intent_id: string | null
          token_paid: number | null
          total_amount: number
          updated_at: string | null
          verification_status: string | null
        }
        Insert: {
          advance_paid?: number | null
          allergies?: string | null
          base_amount: number
          cancellation_reason?: string | null
          check_in_date: string
          check_out_date: string
          created_at?: string | null
          customer_id: string
          extra_fees?: number | null
          food_preference?: string | null
          food_required?: boolean | null
          guest_charges?: number | null
          guest_relations_call_completed_at?: string | null
          guest_relations_call_completed_by?: string | null
          guest_relations_call_status?: string | null
          id?: string
          id_proofs?: string[] | null
          manual_reference?: string | null
          num_guests: number
          payment_method?: string | null
          payment_screenshot_url?: string | null
          payment_status?: string | null
          property_id: string
          special_requests?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          token_paid?: number | null
          total_amount: number
          updated_at?: string | null
          verification_status?: string | null
        }
        Update: {
          advance_paid?: number | null
          allergies?: string | null
          base_amount?: number
          cancellation_reason?: string | null
          check_in_date?: string
          check_out_date?: string
          created_at?: string | null
          customer_id?: string
          extra_fees?: number | null
          food_preference?: string | null
          food_required?: boolean | null
          guest_charges?: number | null
          guest_relations_call_completed_at?: string | null
          guest_relations_call_completed_by?: string | null
          guest_relations_call_status?: string | null
          id?: string
          id_proofs?: string[] | null
          manual_reference?: string | null
          num_guests?: number
          payment_method?: string | null
          payment_screenshot_url?: string | null
          payment_status?: string | null
          property_id?: string
          special_requests?: string | null
          status?: string | null
          stripe_payment_intent_id?: string | null
          token_paid?: number | null
          total_amount?: number
          updated_at?: string | null
          verification_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bookings_property_id_fkey"
            columns: ["property_id"]
            isOneToOne: false
            referencedRelation: "properties"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
          phone: string | null
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      properties: {
        Row: {
          base_price_per_night: number
          city: string | null
          cleaning_fee: number | null
          created_at: string | null
          description: string | null
          facilities: string[] | null
          id: string
          images: string[] | null
          is_active: boolean | null
          location: string
          max_guests: number
          name: string
          per_head_charge: number | null
          service_fee: number | null
          state: string | null
          updated_at: string | null
          zip_code: string | null
        }
        Insert: {
          base_price_per_night: number
          city?: string | null
          cleaning_fee?: number | null
          created_at?: string | null
          description?: string | null
          facilities?: string[] | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          location: string
          max_guests?: number
          name: string
          per_head_charge?: number | null
          service_fee?: number | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Update: {
          base_price_per_night?: number
          city?: string | null
          cleaning_fee?: number | null
          created_at?: string | null
          description?: string | null
          facilities?: string[] | null
          id?: string
          images?: string[] | null
          is_active?: boolean | null
          location?: string
          max_guests?: number
          name?: string
          per_head_charge?: number | null
          service_fee?: number | null
          state?: string | null
          updated_at?: string | null
          zip_code?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      app_role: "admin" | "customer"
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
      app_role: ["admin", "customer"],
    },
  },
} as const
