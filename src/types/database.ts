export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string | null;
          display_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          display_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      invites: {
        Row: {
          id: string;
          email: string;
          token: string;
          inviter_id: string;
          used_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          token: string;
          inviter_id: string;
          used_at?: string | null;
          created_at?: string;
        };
        Update: {
          email?: string;
          token?: string;
          inviter_id?: string;
          used_at?: string | null;
        };
      };
      episodes: {
        Row: {
          id: string;
          season: number;
          episode_number: number;
          vote_out_lock_at: string;
          voted_out_player_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          season: number;
          episode_number: number;
          vote_out_lock_at: string;
          voted_out_player_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          voted_out_player_id?: string | null;
          updated_at?: string;
        };
      };
      winner_picks: {
        Row: {
          id: string;
          user_id: string;
          player_id: string | null;
          season: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          player_id?: string | null;
          season: number;
          created_at?: string;
        };
        Update: {
          player_id?: string | null;
        };
      };
      user_season_points: {
        Row: {
          user_id: string;
          season: number;
          points: number;
          survival_points: number;
          tribe_immunity_points: number;
          individual_immunity_points: number;
          weeks_survived: number;
          eliminations_hit: number;
          last_week_delta: number | null;
        };
        Insert: {
          user_id: string;
          season: number;
          points?: number;
          survival_points?: number;
          tribe_immunity_points?: number;
          individual_immunity_points?: number;
          weeks_survived?: number;
          eliminations_hit?: number;
          last_week_delta?: number | null;
        };
        Update: {
          points?: number;
          survival_points?: number;
          tribe_immunity_points?: number;
          individual_immunity_points?: number;
          weeks_survived?: number;
          eliminations_hit?: number;
          last_week_delta?: number | null;
        };
      };
      episode_points_processed: {
        Row: { episode_id: string };
        Insert: { episode_id: string };
        Update: never;
      };
      vote_out_picks: {
        Row: {
          id: string;
          user_id: string;
          episode_id: string;
          player_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          episode_id: string;
          player_id: string;
          created_at?: string;
        };
        Update: {
          player_id?: string;
        };
      };
      tribe_picks: {
        Row: {
          id: string;
          user_id: string;
          tribe_id: string;
          season: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tribe_id: string;
          season: number;
          created_at?: string;
        };
        Update: {
          tribe_id?: string;
        };
      };
    };
  };
}
