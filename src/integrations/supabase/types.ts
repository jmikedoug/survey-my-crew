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
      affiliate_clicks: {
        Row: {
          affiliate_link_id: string
          clicked_at: string
          id: string
          referrer: string | null
        }
        Insert: {
          affiliate_link_id: string
          clicked_at?: string
          id?: string
          referrer?: string | null
        }
        Update: {
          affiliate_link_id?: string
          clicked_at?: string
          id?: string
          referrer?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_link_id_fkey"
            columns: ["affiliate_link_id"]
            isOneToOne: false
            referencedRelation: "affiliate_links"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_links: {
        Row: {
          created_at: string
          id: string
          label: string
          question_id: string | null
          source: Database["public"]["Enums"]["affiliate_source"]
          survey_id: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          label: string
          question_id?: string | null
          source?: Database["public"]["Enums"]["affiliate_source"]
          survey_id?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          label?: string
          question_id?: string | null
          source?: Database["public"]["Enums"]["affiliate_source"]
          survey_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_links_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_links_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      answers: {
        Row: {
          id: string
          question_id: string
          response_id: string
          suggested_url: string | null
          value_choice: string | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          id?: string
          question_id: string
          response_id: string
          suggested_url?: string | null
          value_choice?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          id?: string
          question_id?: string
          response_id?: string
          suggested_url?: string | null
          value_choice?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "answers_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "responses"
            referencedColumns: ["id"]
          },
        ]
      }
      audiences: {
        Row: {
          created_at: string
          criteria: Json
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          criteria?: Json
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          criteria?: Json
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age_range: string | null
          amazon_tag: string | null
          avatar_url: string | null
          created_at: string
          display_name: string | null
          ethnicity: string[] | null
          etsy_tag: string | null
          gender: string | null
          hair_type: string | null
          id: string
          interests: string[] | null
          location_region: string | null
          updated_at: string
        }
        Insert: {
          age_range?: string | null
          amazon_tag?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          ethnicity?: string[] | null
          etsy_tag?: string | null
          gender?: string | null
          hair_type?: string | null
          id: string
          interests?: string[] | null
          location_region?: string | null
          updated_at?: string
        }
        Update: {
          age_range?: string | null
          amazon_tag?: string | null
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          ethnicity?: string[] | null
          etsy_tag?: string | null
          gender?: string | null
          hair_type?: string | null
          id?: string
          interests?: string[] | null
          location_region?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      questions: {
        Row: {
          id: string
          options: Json | null
          position: number
          prompt: string
          survey_id: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Insert: {
          id?: string
          options?: Json | null
          position: number
          prompt: string
          survey_id: string
          type: Database["public"]["Enums"]["question_type"]
        }
        Update: {
          id?: string
          options?: Json | null
          position?: number
          prompt?: string
          survey_id?: string
          type?: Database["public"]["Enums"]["question_type"]
        }
        Relationships: [
          {
            foreignKeyName: "questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      responses: {
        Row: {
          created_at: string
          id: string
          respondent_name: string | null
          respondent_token: string | null
          survey_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          respondent_name?: string | null
          respondent_token?: string | null
          survey_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          respondent_name?: string | null
          respondent_token?: string | null
          survey_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_audiences: {
        Row: {
          audience_id: string
          created_at: string
          quota: number | null
          survey_id: string
        }
        Insert: {
          audience_id: string
          created_at?: string
          quota?: number | null
          survey_id: string
        }
        Update: {
          audience_id?: string
          created_at?: string
          quota?: number | null
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_audiences_audience_id_fkey"
            columns: ["audience_id"]
            isOneToOne: false
            referencedRelation: "audiences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "survey_audiences_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          category: string | null
          created_at: string
          creator_token: string
          description: string | null
          id: string
          slug: string
          title: string
          user_id: string | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          creator_token: string
          description?: string | null
          id?: string
          slug: string
          title: string
          user_id?: string | null
        }
        Update: {
          category?: string | null
          created_at?: string
          creator_token?: string
          description?: string | null
          id?: string
          slug?: string
          title?: string
          user_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      claim_responses: { Args: { _token: string }; Returns: number }
      claim_surveys: { Args: { _token: string }; Returns: number }
      discover_polls: {
        Args: { _category: string; _only_matching: boolean }
        Returns: Json
      }
      duplicate_survey: {
        Args: { _new_slug: string; _slug: string }
        Returns: string
      }
      get_survey_results: { Args: { _slug: string }; Returns: Json }
    }
    Enums: {
      affiliate_source: "amazon" | "etsy" | "creator" | "other"
      question_type:
        | "rating"
        | "choice"
        | "text"
        | "yes_no"
        | "product_suggestion"
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
      affiliate_source: ["amazon", "etsy", "creator", "other"],
      question_type: [
        "rating",
        "choice",
        "text",
        "yes_no",
        "product_suggestion",
      ],
    },
  },
} as const
