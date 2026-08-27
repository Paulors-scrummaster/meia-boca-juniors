export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      athlete_invites: {
        Row: {
          athlete_id: string
          auth_user_id: string | null
          created_at: string
          created_by: string
          email_normalized: string
          id: string
          redeemed_at: string | null
          redeemed_by: string | null
          revoked_at: string | null
        }
        Insert: {
          athlete_id: string
          auth_user_id?: string | null
          created_at?: string
          created_by: string
          email_normalized: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          revoked_at?: string | null
        }
        Update: {
          athlete_id?: string
          auth_user_id?: string | null
          created_at?: string
          created_by?: string
          email_normalized?: string
          id?: string
          redeemed_at?: string | null
          redeemed_by?: string | null
          revoked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athlete_invites_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "athlete_invites_redeemed_by_fkey"
            columns: ["redeemed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      athletes: {
        Row: {
          anonymized_at: string | null
          created_at: string
          full_name: string
          id: string
          inactivated_at: string | null
          photo_path: string | null
          primary_position: string
          shirt_name: string
          shirt_number: number
          status: Database["public"]["Enums"]["athlete_status"]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          anonymized_at?: string | null
          created_at?: string
          full_name: string
          id?: string
          inactivated_at?: string | null
          photo_path?: string | null
          primary_position: string
          shirt_name: string
          shirt_number: number
          status?: Database["public"]["Enums"]["athlete_status"]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          anonymized_at?: string | null
          created_at?: string
          full_name?: string
          id?: string
          inactivated_at?: string | null
          photo_path?: string | null
          primary_position?: string
          shirt_name?: string
          shirt_number?: number
          status?: Database["public"]["Enums"]["athlete_status"]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "athletes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string
          after_state: Json | null
          before_state: Json | null
          created_at: string
          id: string
          resource_id: string | null
          resource_type: string
          trace_id: string
        }
        Insert: {
          action: string
          actor_user_id: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          resource_id?: string | null
          resource_type: string
          trace_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string
          after_state?: Json | null
          before_state?: Json | null
          created_at?: string
          id?: string
          resource_id?: string | null
          resource_type?: string
          trace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_deliveries: {
        Row: {
          attempt_count: number
          created_at: string
          event_id: string
          id: string
          last_error_code: string | null
          next_attempt_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["notification_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          event_id: string
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          event_id?: string
          id?: string
          last_error_code?: string | null
          next_attempt_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["notification_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_deliveries_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "notification_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_deliveries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_events: {
        Row: {
          created_at: string
          deduplication_key: string
          id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          occurred_at: string
          payload: Json
          resource_id: string
          resource_type: string
        }
        Insert: {
          created_at?: string
          deduplication_key: string
          id?: string
          kind: Database["public"]["Enums"]["notification_kind"]
          occurred_at?: string
          payload?: Json
          resource_id: string
          resource_type: string
        }
        Update: {
          created_at?: string
          deduplication_key?: string
          id?: string
          kind?: Database["public"]["Enums"]["notification_kind"]
          occurred_at?: string
          payload?: Json
          resource_id?: string
          resource_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          account_status: Database["public"]["Enums"]["account_status"]
          created_at: string
          disabled_at: string | null
          id: string
          must_change_password: boolean
          updated_at: string
        }
        Insert: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          disabled_at?: string | null
          id: string
          must_change_password?: boolean
          updated_at?: string
        }
        Update: {
          account_status?: Database["public"]["Enums"]["account_status"]
          created_at?: string
          disabled_at?: string | null
          id?: string
          must_change_password?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string
          assigned_by: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_at?: string
          assigned_by: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_at?: string
          assigned_by?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_athlete_invitation: {
        Args: { invitation_uuid: string; request_trace_id: string }
        Returns: Json
      }
      complete_admin_password_reset: {
        Args: {
          actor_user_id: string
          command_idempotency_key: string
          request_trace_id: string
          target_user_id: string
        }
        Returns: Json
      }
      complete_forced_password_change: {
        Args: { request_trace_id: string }
        Returns: Json
      }
      consume_identity_rate_limit: {
        Args: {
          counter_scope: string
          maximum_attempts: number
          subject_key: string
          window_seconds: number
        }
        Returns: {
          allowed: boolean
          remaining: number
          resets_at: string
        }[]
      }
      create_identity_invite: {
        Args: {
          actor_user_id: string
          athlete_uuid: string
          command_idempotency_key: string
          invitation_auth_user_id: string
          normalized_email: string
          request_trace_id: string
        }
        Returns: Json
      }
      record_identity_invite_resend: {
        Args: {
          actor_user_id: string
          command_idempotency_key: string
          invitation_uuid: string
          request_trace_id: string
        }
        Returns: Json
      }
      revoke_identity_invite: {
        Args: {
          actor_user_id: string
          athlete_uuid: string
          command_idempotency_key: string
          request_trace_id: string
        }
        Returns: Json
      }
      set_user_role: {
        Args: {
          request_trace_id: string
          should_assign: boolean
          target_role: Database["public"]["Enums"]["app_role"]
          target_user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      account_status: "ACTIVE" | "DISABLED"
      app_role: "PRESIDENT" | "COACH" | "ATHLETE"
      athlete_status: "ACTIVE" | "INJURED" | "SUSPENDED" | "INACTIVE"
      call_status: "CALLED" | "NOT_CALLED"
      lineup_assignment: "STARTER" | "RESERVE"
      lineup_status: "DRAFT" | "PUBLISHED" | "SUPERSEDED"
      match_status: "SCHEDULED" | "COMPLETED" | "CANCELLED"
      notification_kind:
        | "CALL_UP"
        | "DEADLINE_24H"
        | "DEADLINE_6H"
        | "MATCH_CHANGED"
        | "LINEUP_PUBLISHED"
        | "VOTING_OPENED"
        | "NOTICE_PUBLISHED"
      notification_status:
        | "PENDING"
        | "PROCESSING"
        | "SENT"
        | "FAILED"
        | "SKIPPED"
      presence_status: "PENDING" | "CONFIRMED" | "DECLINED"
      voting_round_status: "OPEN" | "CLOSED" | "INVALIDATED"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      account_status: ["ACTIVE", "DISABLED"],
      app_role: ["PRESIDENT", "COACH", "ATHLETE"],
      athlete_status: ["ACTIVE", "INJURED", "SUSPENDED", "INACTIVE"],
      call_status: ["CALLED", "NOT_CALLED"],
      lineup_assignment: ["STARTER", "RESERVE"],
      lineup_status: ["DRAFT", "PUBLISHED", "SUPERSEDED"],
      match_status: ["SCHEDULED", "COMPLETED", "CANCELLED"],
      notification_kind: [
        "CALL_UP",
        "DEADLINE_24H",
        "DEADLINE_6H",
        "MATCH_CHANGED",
        "LINEUP_PUBLISHED",
        "VOTING_OPENED",
        "NOTICE_PUBLISHED",
      ],
      notification_status: [
        "PENDING",
        "PROCESSING",
        "SENT",
        "FAILED",
        "SKIPPED",
      ],
      presence_status: ["PENDING", "CONFIRMED", "DECLINED"],
      voting_round_status: ["OPEN", "CLOSED", "INVALIDATED"],
    },
  },
} as const
