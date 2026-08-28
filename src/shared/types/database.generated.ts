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
      allowed_formations: {
        Row: {
          code: string
          display_order: number
          is_active: boolean
        }
        Insert: {
          code: string
          display_order: number
          is_active?: boolean
        }
        Update: {
          code?: string
          display_order?: number
          is_active?: boolean
        }
        Relationships: []
      }
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
            foreignKeyName: "athlete_invites_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "athlete_invites_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "athlete_invites_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
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
      lineup_players: {
        Row: {
          assignment: Database["public"]["Enums"]["lineup_assignment"]
          athlete_id: string
          display_order: number
          lineup_id: string
          position_x: number | null
          position_y: number | null
          tactical_position: string | null
        }
        Insert: {
          assignment: Database["public"]["Enums"]["lineup_assignment"]
          athlete_id: string
          display_order?: number
          lineup_id: string
          position_x?: number | null
          position_y?: number | null
          tactical_position?: string | null
        }
        Update: {
          assignment?: Database["public"]["Enums"]["lineup_assignment"]
          athlete_id?: string
          display_order?: number
          lineup_id?: string
          position_x?: number | null
          position_y?: number | null
          tactical_position?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lineup_players_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_players_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "lineup_players_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "lineup_players_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
          },
          {
            foreignKeyName: "lineup_players_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_players_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "published_lineup_view"
            referencedColumns: ["lineup_id"]
          },
        ]
      }
      lineups: {
        Row: {
          created_at: string
          created_by: string
          formation_code: string
          id: string
          match_id: string
          published_at: string | null
          published_by: string | null
          revision: number
          status: Database["public"]["Enums"]["lineup_status"]
        }
        Insert: {
          created_at?: string
          created_by: string
          formation_code: string
          id?: string
          match_id: string
          published_at?: string | null
          published_by?: string | null
          revision: number
          status?: Database["public"]["Enums"]["lineup_status"]
        }
        Update: {
          created_at?: string
          created_by?: string
          formation_code?: string
          id?: string
          match_id?: string
          published_at?: string | null
          published_by?: string | null
          revision?: number
          status?: Database["public"]["Enums"]["lineup_status"]
        }
        Relationships: [
          {
            foreignKeyName: "lineups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_formation_code_fkey"
            columns: ["formation_code"]
            isOneToOne: false
            referencedRelation: "allowed_formations"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "next_match_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pending_action_metrics"
            referencedColumns: ["match_id"]
          },
          {
            foreignKeyName: "lineups_published_by_fkey"
            columns: ["published_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      match_consolidations: {
        Row: {
          consolidated_at: string
          consolidated_by: string
          id: string
          idempotency_key: string
          invalidated_at: string | null
          invalidated_by: string | null
          lineup_id: string
          match_id: string
          mbj_score: number
          opponent_score: number
          revision: number
          status: Database["public"]["Enums"]["consolidation_status"]
        }
        Insert: {
          consolidated_at?: string
          consolidated_by: string
          id?: string
          idempotency_key: string
          invalidated_at?: string | null
          invalidated_by?: string | null
          lineup_id: string
          match_id: string
          mbj_score: number
          opponent_score: number
          revision: number
          status?: Database["public"]["Enums"]["consolidation_status"]
        }
        Update: {
          consolidated_at?: string
          consolidated_by?: string
          id?: string
          idempotency_key?: string
          invalidated_at?: string | null
          invalidated_by?: string | null
          lineup_id?: string
          match_id?: string
          mbj_score?: number
          opponent_score?: number
          revision?: number
          status?: Database["public"]["Enums"]["consolidation_status"]
        }
        Relationships: [
          {
            foreignKeyName: "match_consolidations_consolidated_by_fkey"
            columns: ["consolidated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_consolidations_invalidated_by_fkey"
            columns: ["invalidated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_consolidations_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_consolidations_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "published_lineup_view"
            referencedColumns: ["lineup_id"]
          },
          {
            foreignKeyName: "match_consolidations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_consolidations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "next_match_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_consolidations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pending_action_metrics"
            referencedColumns: ["match_id"]
          },
        ]
      }
      match_goals: {
        Row: {
          assistant_athlete_id: string | null
          consolidation_id: string
          created_at: string
          created_by: string
          id: string
          is_opponent_own_goal: boolean
          scorer_athlete_id: string | null
          sequence_number: number
        }
        Insert: {
          assistant_athlete_id?: string | null
          consolidation_id: string
          created_at?: string
          created_by: string
          id?: string
          is_opponent_own_goal?: boolean
          scorer_athlete_id?: string | null
          sequence_number: number
        }
        Update: {
          assistant_athlete_id?: string | null
          consolidation_id?: string
          created_at?: string
          created_by?: string
          id?: string
          is_opponent_own_goal?: boolean
          scorer_athlete_id?: string | null
          sequence_number?: number
        }
        Relationships: [
          {
            foreignKeyName: "match_goals_assistant_athlete_id_fkey"
            columns: ["assistant_athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_goals_assistant_athlete_id_fkey"
            columns: ["assistant_athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "match_goals_assistant_athlete_id_fkey"
            columns: ["assistant_athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "match_goals_assistant_athlete_id_fkey"
            columns: ["assistant_athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
          },
          {
            foreignKeyName: "match_goals_consolidation_id_fkey"
            columns: ["consolidation_id"]
            isOneToOne: false
            referencedRelation: "match_consolidations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_goals_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_goals_scorer_athlete_id_fkey"
            columns: ["scorer_athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_goals_scorer_athlete_id_fkey"
            columns: ["scorer_athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "match_goals_scorer_athlete_id_fkey"
            columns: ["scorer_athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "match_goals_scorer_athlete_id_fkey"
            columns: ["scorer_athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
          },
        ]
      }
      match_presences: {
        Row: {
          athlete_id: string
          call_revision: number
          call_status: Database["public"]["Enums"]["call_status"]
          called_at: string | null
          created_at: string
          id: string
          individual_deadline: string | null
          is_exceptional_call: boolean
          last_changed_by: string | null
          match_id: string
          presence_status: Database["public"]["Enums"]["presence_status"]
          responded_at: string | null
          updated_at: string
        }
        Insert: {
          athlete_id: string
          call_revision?: number
          call_status?: Database["public"]["Enums"]["call_status"]
          called_at?: string | null
          created_at?: string
          id?: string
          individual_deadline?: string | null
          is_exceptional_call?: boolean
          last_changed_by?: string | null
          match_id: string
          presence_status?: Database["public"]["Enums"]["presence_status"]
          responded_at?: string | null
          updated_at?: string
        }
        Update: {
          athlete_id?: string
          call_revision?: number
          call_status?: Database["public"]["Enums"]["call_status"]
          called_at?: string | null
          created_at?: string
          id?: string
          individual_deadline?: string | null
          is_exceptional_call?: boolean
          last_changed_by?: string | null
          match_id?: string
          presence_status?: Database["public"]["Enums"]["presence_status"]
          responded_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
          },
          {
            foreignKeyName: "match_presences_last_changed_by_fkey"
            columns: ["last_changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_presences_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_presences_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "next_match_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_presences_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pending_action_metrics"
            referencedColumns: ["match_id"]
          },
        ]
      }
      matches: {
        Row: {
          competition_name: string | null
          confirmation_deadline: string
          created_at: string
          created_by: string
          current_consolidation_id: string | null
          id: string
          location_name: string | null
          match_date: string
          opponent_name: string
          schedule_revision: number
          season_id: string
          status: Database["public"]["Enums"]["match_status"]
          updated_at: string
          updated_by: string
        }
        Insert: {
          competition_name?: string | null
          confirmation_deadline: string
          created_at?: string
          created_by: string
          current_consolidation_id?: string | null
          id?: string
          location_name?: string | null
          match_date: string
          opponent_name: string
          schedule_revision?: number
          season_id: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          updated_by: string
        }
        Update: {
          competition_name?: string | null
          confirmation_deadline?: string
          created_at?: string
          created_by?: string
          current_consolidation_id?: string | null
          id?: string
          location_name?: string | null
          match_date?: string
          opponent_name?: string
          schedule_revision?: number
          season_id?: string
          status?: Database["public"]["Enums"]["match_status"]
          updated_at?: string
          updated_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_current_consolidation_fk"
            columns: ["current_consolidation_id"]
            isOneToOne: false
            referencedRelation: "match_consolidations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mvp_awards: {
        Row: {
          athlete_id: string
          awarded_at: string
          invalidated_at: string | null
          vote_count: number
          voting_round_id: string
        }
        Insert: {
          athlete_id: string
          awarded_at?: string
          invalidated_at?: string | null
          vote_count: number
          voting_round_id: string
        }
        Update: {
          athlete_id?: string
          awarded_at?: string
          invalidated_at?: string | null
          vote_count?: number
          voting_round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mvp_awards_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_awards_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "mvp_awards_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "mvp_awards_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
          },
          {
            foreignKeyName: "mvp_awards_voting_round_id_fkey"
            columns: ["voting_round_id"]
            isOneToOne: false
            referencedRelation: "mvp_voting_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_awards_voting_round_id_fkey"
            columns: ["voting_round_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voting_round_id"]
          },
        ]
      }
      mvp_votes: {
        Row: {
          created_at: string
          id: string
          voted_athlete_id: string
          voter_athlete_id: string
          voting_round_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          voted_athlete_id: string
          voter_athlete_id: string
          voting_round_id: string
        }
        Update: {
          created_at?: string
          id?: string
          voted_athlete_id?: string
          voter_athlete_id?: string
          voting_round_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mvp_votes_voted_athlete_id_fkey"
            columns: ["voted_athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_voted_athlete_id_fkey"
            columns: ["voted_athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "mvp_votes_voted_athlete_id_fkey"
            columns: ["voted_athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "mvp_votes_voted_athlete_id_fkey"
            columns: ["voted_athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
          },
          {
            foreignKeyName: "mvp_votes_voter_athlete_id_fkey"
            columns: ["voter_athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_voter_athlete_id_fkey"
            columns: ["voter_athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "mvp_votes_voter_athlete_id_fkey"
            columns: ["voter_athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "mvp_votes_voter_athlete_id_fkey"
            columns: ["voter_athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
          },
          {
            foreignKeyName: "mvp_votes_voting_round_id_fkey"
            columns: ["voting_round_id"]
            isOneToOne: false
            referencedRelation: "mvp_voting_rounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_votes_voting_round_id_fkey"
            columns: ["voting_round_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voting_round_id"]
          },
        ]
      }
      mvp_voting_rounds: {
        Row: {
          closed_at: string | null
          closes_at: string
          consolidation_id: string
          created_by: string
          id: string
          invalidated_at: string | null
          opens_at: string
          status: Database["public"]["Enums"]["voting_round_status"]
        }
        Insert: {
          closed_at?: string | null
          closes_at: string
          consolidation_id: string
          created_by: string
          id?: string
          invalidated_at?: string | null
          opens_at?: string
          status?: Database["public"]["Enums"]["voting_round_status"]
        }
        Update: {
          closed_at?: string | null
          closes_at?: string
          consolidation_id?: string
          created_by?: string
          id?: string
          invalidated_at?: string | null
          opens_at?: string
          status?: Database["public"]["Enums"]["voting_round_status"]
        }
        Relationships: [
          {
            foreignKeyName: "mvp_voting_rounds_consolidation_id_fkey"
            columns: ["consolidation_id"]
            isOneToOne: true
            referencedRelation: "match_consolidations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mvp_voting_rounds_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          body: string
          id: string
          published_at: string
          published_by: string
          title: string
        }
        Insert: {
          body: string
          id?: string
          published_at?: string
          published_by: string
          title: string
        }
        Update: {
          body?: string
          id?: string
          published_at?: string
          published_by?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_published_by_fkey"
            columns: ["published_by"]
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
      presence_justifications: {
        Row: {
          created_at: string
          created_by: string
          presence_id: string
          reason: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          presence_id: string
          reason: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          presence_id?: string
          reason?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presence_justifications_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_justifications_presence_id_fkey"
            columns: ["presence_id"]
            isOneToOne: true
            referencedRelation: "match_presences"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presence_justifications_presence_id_fkey"
            columns: ["presence_id"]
            isOneToOne: true
            referencedRelation: "next_match_view"
            referencedColumns: ["presence_id"]
          },
          {
            foreignKeyName: "presence_justifications_presence_id_fkey"
            columns: ["presence_id"]
            isOneToOne: true
            referencedRelation: "roster_presence_view"
            referencedColumns: ["presence_id"]
          },
          {
            foreignKeyName: "presence_justifications_presence_id_fkey"
            columns: ["presence_id"]
            isOneToOne: true
            referencedRelation: "staff_attendance_view"
            referencedColumns: ["presence_id"]
          },
        ]
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
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          last_seen_at: string
          provider_subscription_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_seen_at?: string
          provider_subscription_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          last_seen_at?: string
          provider_subscription_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          year?: number
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
      next_match_view: {
        Row: {
          applicable_deadline: string | null
          call_status: Database["public"]["Enums"]["call_status"] | null
          competition_name: string | null
          confirmation_deadline: string | null
          id: string | null
          individual_deadline: string | null
          is_exceptional_call: boolean | null
          location_name: string | null
          match_date: string | null
          opponent_name: string | null
          presence_id: string | null
          presence_status: Database["public"]["Enums"]["presence_status"] | null
          schedule_revision: number | null
          season_id: string | null
          status: Database["public"]["Enums"]["match_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["season_id"]
          },
          {
            foreignKeyName: "matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_delivery_metrics: {
        Row: {
          delivery_count: number | null
          kind: Database["public"]["Enums"]["notification_kind"] | null
          last_updated_at: string | null
          status: Database["public"]["Enums"]["notification_status"] | null
        }
        Relationships: []
      }
      notification_dispatch_health: {
        Row: {
          failed_delivery_count: number | null
          last_successful_dispatch_at: string | null
        }
        Relationships: []
      }
      notification_failure_metrics: {
        Row: {
          failure_count: number | null
          kind: Database["public"]["Enums"]["notification_kind"] | null
          last_error_code: string | null
          last_updated_at: string | null
        }
        Relationships: []
      }
      open_mvp_voting_view: {
        Row: {
          assignment: Database["public"]["Enums"]["lineup_assignment"] | null
          candidate_athlete_id: string | null
          closes_at: string | null
          has_voted: boolean | null
          lineup_id: string | null
          match_id: string | null
          opens_at: string | null
          shirt_name: string | null
          shirt_number: number | null
          voter_athlete_id: string | null
          voting_round_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_consolidations_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "lineups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_consolidations_lineup_id_fkey"
            columns: ["lineup_id"]
            isOneToOne: false
            referencedRelation: "published_lineup_view"
            referencedColumns: ["lineup_id"]
          },
          {
            foreignKeyName: "match_consolidations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_consolidations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "next_match_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_consolidations_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pending_action_metrics"
            referencedColumns: ["match_id"]
          },
        ]
      }
      pending_action_metrics: {
        Row: {
          match_id: string | null
          pending_presence_count: number | null
        }
        Relationships: []
      }
      published_lineup_view: {
        Row: {
          assignment: Database["public"]["Enums"]["lineup_assignment"] | null
          athlete_id: string | null
          display_order: number | null
          formation_code: string | null
          lineup_id: string | null
          match_id: string | null
          position_x: number | null
          position_y: number | null
          published_at: string | null
          revision: number | null
          shirt_name: string | null
          shirt_number: number | null
          tactical_position: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lineup_players_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineup_players_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "lineup_players_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "lineup_players_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
          },
          {
            foreignKeyName: "lineups_formation_code_fkey"
            columns: ["formation_code"]
            isOneToOne: false
            referencedRelation: "allowed_formations"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "next_match_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lineups_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pending_action_metrics"
            referencedColumns: ["match_id"]
          },
        ]
      }
      roster_presence_view: {
        Row: {
          athlete_id: string | null
          athlete_name: string | null
          call_revision: number | null
          call_status: Database["public"]["Enums"]["call_status"] | null
          individual_deadline: string | null
          is_exceptional_call: boolean | null
          match_id: string | null
          presence_id: string | null
          presence_status: Database["public"]["Enums"]["presence_status"] | null
          responded_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
          },
          {
            foreignKeyName: "match_presences_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_presences_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "next_match_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_presences_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pending_action_metrics"
            referencedColumns: ["match_id"]
          },
        ]
      }
      season_rankings_view: {
        Row: {
          assists: number | null
          athlete_id: string | null
          goals: number | null
          mvp_awards: number | null
          presences: number | null
          season_id: string | null
          shirt_name: string | null
          shirt_number: number | null
          year: number | null
        }
        Relationships: []
      }
      staff_attendance_view: {
        Row: {
          applicable_deadline: string | null
          athlete_id: string | null
          athlete_name: string | null
          call_revision: number | null
          call_status: Database["public"]["Enums"]["call_status"] | null
          individual_deadline: string | null
          is_exceptional_call: boolean | null
          match_id: string | null
          presence_id: string | null
          presence_status: Database["public"]["Enums"]["presence_status"] | null
          reason: string | null
          responded_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "athletes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["candidate_athlete_id"]
          },
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "open_mvp_voting_view"
            referencedColumns: ["voter_athlete_id"]
          },
          {
            foreignKeyName: "match_presences_athlete_id_fkey"
            columns: ["athlete_id"]
            isOneToOne: false
            referencedRelation: "season_rankings_view"
            referencedColumns: ["athlete_id"]
          },
          {
            foreignKeyName: "match_presences_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_presences_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "next_match_view"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "match_presences_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "pending_action_metrics"
            referencedColumns: ["match_id"]
          },
        ]
      }
    }
    Functions: {
      accept_athlete_invitation: {
        Args: { invitation_uuid: string; request_trace_id: string }
        Returns: Json
      }
      admin_set_presence: {
        Args: {
          athlete_uuid: string
          change_explanation: string
          command_idempotency_key: string
          match_uuid: string
          refusal_reason: string
          target_status: Database["public"]["Enums"]["presence_status"]
        }
        Returns: Json
      }
      anonymize_athlete: {
        Args: { athlete_uuid: string; request_trace_id: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "athletes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancel_match: {
        Args: { command_idempotency_key: string; match_uuid: string }
        Returns: Json
      }
      cast_mvp_vote: {
        Args: {
          candidate_athlete_uuid: string
          command_idempotency_key: string
          voting_round_uuid: string
        }
        Returns: Json
      }
      claim_notification_deliveries: {
        Args: { batch_limit: number }
        Returns: {
          attempt_count: number
          delivery_id: string
          external_id: string
          kind: Database["public"]["Enums"]["notification_kind"]
          payload: Json
          subscription_id: string
        }[]
      }
      close_mvp_voting: { Args: { voting_round_uuid: string }; Returns: Json }
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
      complete_notification_delivery: {
        Args: {
          delivery_uuid: string
          outcome: string
          retry_at?: string
          safe_error_code?: string
        }
        Returns: undefined
      }
      consolidate_match: {
        Args: {
          command_idempotency_key: string
          goals_input: Json
          match_uuid: string
          mbj_score_input: number
          opponent_score_input: number
        }
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
      create_athlete: {
        Args: {
          full_name_input: string
          photo_path_input: string
          primary_position_input: string
          request_trace_id: string
          shirt_name_input: string
          shirt_number_input: number
          status_input: Database["public"]["Enums"]["athlete_status"]
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "athletes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_exceptional_call: {
        Args: {
          athlete_uuid: string
          command_idempotency_key: string
          individual_deadline_input: string
          match_uuid: string
        }
        Returns: Json
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
      create_match: {
        Args: {
          command_idempotency_key: string
          competition_name_input: string
          confirmation_deadline_input: string
          location_name_input: string
          match_date_input: string
          opponent_name_input: string
          season_uuid: string
        }
        Returns: Json
      }
      publish_lineup: {
        Args: {
          command_idempotency_key: string
          draft_lineup_uuid: string
          match_uuid: string
        }
        Returns: Json
      }
      publish_notice: {
        Args: {
          body_input: string
          command_idempotency_key: string
          title_input: string
        }
        Returns: Json
      }
      reactivate_match: {
        Args: { command_idempotency_key: string; match_uuid: string }
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
      reopen_match_statistics: {
        Args: {
          command_idempotency_key: string
          correction_explanation: string
          match_uuid: string
        }
        Returns: Json
      }
      reschedule_match: {
        Args: {
          command_idempotency_key: string
          competition_name_input: string
          confirmation_deadline_input: string
          location_name_input: string
          match_date_input: string
          match_uuid: string
          opponent_name_input: string
        }
        Returns: Json
      }
      respond_to_call: {
        Args: {
          command_idempotency_key: string
          match_uuid: string
          refusal_reason: string
          target_status: Database["public"]["Enums"]["presence_status"]
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
      set_athlete_status: {
        Args: {
          athlete_uuid: string
          replacement_shirt_number: number
          request_trace_id: string
          target_status: Database["public"]["Enums"]["athlete_status"]
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "athletes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      set_match_callups: {
        Args: {
          called_athlete_ids: string[]
          command_idempotency_key: string
          match_uuid: string
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
      update_athlete: {
        Args: {
          athlete_uuid: string
          full_name_input: string
          photo_path_input: string
          primary_position_input: string
          request_trace_id: string
          shirt_name_input: string
          shirt_number_input: number
        }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "athletes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      account_status: "ACTIVE" | "DISABLED"
      app_role: "PRESIDENT" | "COACH" | "ATHLETE"
      athlete_status: "ACTIVE" | "INJURED" | "SUSPENDED" | "INACTIVE"
      call_status: "CALLED" | "NOT_CALLED"
      consolidation_status: "VALID" | "INVALIDATED"
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
      consolidation_status: ["VALID", "INVALIDATED"],
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
