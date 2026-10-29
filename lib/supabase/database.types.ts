// Generated from the Supabase schema (supabase/migrations). Regenerate after every migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
      accountant_chats: {
        Row: { id: string; user_id: string; title: string; mask_map: Json; fts: unknown; created_at: string; updated_at: string; deleted_at: string | null };
        Insert: { id?: string; user_id?: string; title: string; mask_map?: Json; fts?: unknown; created_at?: string; updated_at?: string; deleted_at?: string | null };
        Update: Partial<Database["public"]["Tables"]["accountant_chats"]["Insert"]>;
        Relationships: [];
      };
      accountant_messages: {
        Row: { id: string; chat_id: string; user_id: string; role: string; content: string; answer: Json | null; checked: boolean; created_at: string };
        Insert: { id?: string; chat_id: string; user_id?: string; role: string; content?: string; answer?: Json | null; checked?: boolean; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["accountant_messages"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "accountant_messages_chat_id_fkey"; columns: ["chat_id"]; isOneToOne: false; referencedRelation: "accountant_chats"; referencedColumns: ["id"] },
        ];
      };
      analyses: {
        Row: {
          code: string;
          confidence: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          model: string;
          result: Json;
          scenario: string;
          title: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          code?: string;
          confidence: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          model: string;
          result: Json;
          scenario: string;
          title: string;
          updated_at?: string;
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["analyses"]["Insert"]>;
        Relationships: [];
      };
      analysis_messages: {
        Row: {
          analysis_id: string;
          created_at: string;
          id: string;
          image_paths: string[];
          role: string;
          text: string;
          user_id: string | null;
        };
        Insert: {
          analysis_id: string;
          created_at?: string;
          id?: string;
          image_paths?: string[];
          role: string;
          text: string;
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["analysis_messages"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "analysis_messages_analysis_id_fkey"; columns: ["analysis_id"]; isOneToOne: false; referencedRelation: "analyses"; referencedColumns: ["id"] },
        ];
      };
      guide_attachments: {
        Row: {
          created_at: string;
          guide_id: string;
          id: string;
          kind: string;
          name: string;
          size_bytes: number;
          storage_path: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          guide_id: string;
          id?: string;
          kind: string;
          name: string;
          size_bytes: number;
          storage_path: string;
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guide_attachments"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "guide_attachments_guide_id_fkey"; columns: ["guide_id"]; isOneToOne: false; referencedRelation: "guides"; referencedColumns: ["id"] },
        ];
      };
      guide_events: {
        Row: { id: number; user_id: string | null; guide_id: string; kind: string; created_at: string };
        Insert: { user_id?: string; guide_id: string; kind?: string; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["guide_events"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "guide_events_guide_id_fkey"; columns: ["guide_id"]; isOneToOne: false; referencedRelation: "guides"; referencedColumns: ["id"] },
        ];
      };
      guide_revisions: {
        Row: {
          created_at: string;
          guide_id: string;
          id: string;
          snapshot: Json | null;
          summary: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          guide_id: string;
          id?: string;
          snapshot?: Json | null;
          summary: string;
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guide_revisions"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "guide_revisions_guide_id_fkey"; columns: ["guide_id"]; isOneToOne: false; referencedRelation: "guides"; referencedColumns: ["id"] },
        ];
      };
      guides: {
        Row: {
          category: string | null;
          cause: string | null;
          code: string;
          created_at: string;
          deleted_at: string | null;
          embedding: string | null;
          error_message: string | null;
          fts: unknown;
          id: string;
          module: string;
          platform: string;
          prevention: string | null;
          product: string;
          steps: string[];
          symptom: string;
          tags: string[];
          title: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string | null;
          uses: number;
          verified: boolean;
          version: string;
        };
        Insert: {
          category?: string | null;
          cause?: string | null;
          code?: string;
          created_at?: string;
          deleted_at?: string | null;
          embedding?: string | null;
          error_message?: string | null;
          fts?: unknown;
          id?: string;
          module?: string;
          platform?: string;
          prevention?: string | null;
          product: string;
          steps?: string[];
          symptom?: string;
          tags?: string[];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
          uses?: number;
          verified?: boolean;
          version?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guides"]["Insert"]>;
        Relationships: [];
      };
      knowledge_articles: {
        Row: {
          id: string;
          user_id: string | null;
          starter_slug: string | null;
          starter_version: number | null;
          edited: boolean;
          title: string;
          category: string;
          tell_customer: string;
          what_it_is: string;
          example: string;
          desktop_steps: string | null;
          cloud_steps: string | null;
          steps_verified: boolean;
          mistakes: string[];
          related: string[];
          sources: Json;
          reviewed: boolean;
          fts: unknown;
          created_at: string;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          starter_slug?: string | null;
          starter_version?: number | null;
          edited?: boolean;
          title: string;
          category: string;
          tell_customer: string;
          what_it_is?: string;
          example?: string;
          desktop_steps?: string | null;
          cloud_steps?: string | null;
          steps_verified?: boolean;
          mistakes?: string[];
          related?: string[];
          sources?: Json;
          reviewed?: boolean;
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["knowledge_articles"]["Insert"]>;
        Relationships: [];
      };
      official_pages: {
        Row: {
          url: string;
          site: string;
          title: string;
          snippet: string;
          lastmod: string | null;
          fts: unknown;
          embedding: string | null;
          details_fetched_at: string | null;
          seen_at: string;
          created_at: string;
        };
        // Written only by the refresh-official Edge Function (service role); users can read.
        Insert: never;
        Update: never;
        Relationships: [];
      };
      pins: {
        Row: {
          created_at: string;
          guide_id: string;
          id: string;
          site: string;
          title: string;
          url: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          guide_id: string;
          id?: string;
          site: string;
          title: string;
          url: string;
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["pins"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "pins_guide_id_fkey"; columns: ["guide_id"]; isOneToOne: false; referencedRelation: "guides"; referencedColumns: ["id"] },
        ];
      };
      sops: {
        Row: {
          id: string;
          user_id: string | null;
          code: string;
          guide_id: string | null;
          title: string;
          version: string;
          purpose: string;
          scope: string;
          steps: Json;
          checks: string[];
          created_at: string;
          updated_at: string;
          updated_by: string | null;
          deleted_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          code?: string;
          guide_id?: string | null;
          title: string;
          version?: string;
          purpose?: string;
          scope?: string;
          steps?: Json;
          checks?: string[];
          created_at?: string;
          updated_at?: string;
          updated_by?: string | null;
          deleted_at?: string | null;
        };
        Update: Partial<Database["public"]["Tables"]["sops"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "sops_guide_id_fkey"; columns: ["guide_id"]; isOneToOne: false; referencedRelation: "guides"; referencedColumns: ["id"] },
        ];
      };
      search_log: {
        Row: { id: number; user_id: string | null; query: string; normalized: string; guide_hits: number; created_at: string };
        Insert: { user_id?: string; query: string; guide_hits: number; created_at?: string };
        Update: Partial<Database["public"]["Tables"]["search_log"]["Insert"]>;
        Relationships: [];
      };
      team_members: {
        Row: { user_id: string; email: string | null; display_name: string; role: "owner" | "member"; status: "pending" | "approved" | "rejected" | "removed"; is_test: boolean; created_at: string; decided_at: string | null };
        // Rows come from the sign-up trigger; the owner may only change status (column grant).
        Insert: never;
        Update: { status?: "pending" | "approved" | "rejected" | "removed" };
        Relationships: [];
      };
      templates: {
        Row: {
          body: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          kind: string;
          tags: string[];
          title: string;
          updated_at: string;
          updated_by: string | null;
          user_id: string | null;
          uses: number;
        };
        Insert: {
          body: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          kind: string;
          tags?: string[];
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          user_id?: string;
          uses?: number;
        };
        Update: Partial<Database["public"]["Tables"]["templates"]["Insert"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          analyst_model: string;
          chat_model: string;
          chat_web_search: boolean;
          default_model: string;
          mask_sensitive: boolean;
          official_sites: string[];
          searxng_url: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          analyst_model?: string;
          chat_model?: string;
          chat_web_search?: boolean;
          default_model?: string;
          mask_sensitive?: boolean;
          official_sites?: string[];
          searxng_url?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["user_settings"]["Insert"]>;
        Relationships: [];
      };
      web_cache: {
        Row: {
          fetched_at: string;
          id: string;
          query: string;
          query_hash: string;
          results: Json;
          user_id: string;
        };
        Insert: {
          fetched_at?: string;
          id?: string;
          query: string;
          query_hash: string;
          results: Json;
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["web_cache"]["Insert"]>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      search_accountant_chats: {
        Args: { p_query: string; p_limit?: number };
        Returns: { id: string; score: number }[];
      };
      accountant_chat_fts: {
        Args: { p_chat_id: string; p_title: string };
        Returns: unknown;
      };
      similar_guides: {
        Args: { p_title: string; p_error?: string; p_limit?: number };
        Returns: { id: string; code: string; title: string; score: number }[];
      };
      search_guides: {
        Args: {
          p_query: string;
          p_embedding?: string | null;
          p_product?: string | null;
          p_module?: string | null;
          p_version?: string | null;
          p_tag?: string | null;
          p_updated_after?: string | null;
          p_min_similarity?: number;
          p_limit?: number;
        };
        Returns: { id: string; code: string; score: number; matched_by: string[] }[];
      };
      search_official_pages: {
        Args: { p_query: string; p_embedding?: string | null; p_min_similarity?: number; p_limit?: number };
        Returns: { url: string; site: string; title: string; snippet: string; lastmod: string | null; score: number; matched_by: string[] }[];
      };
      increment_guide_uses: {
        Args: { p_guide_id: string };
        Returns: undefined;
      };
      normalize_query: { Args: { p: string }; Returns: string };
      search_knowledge: {
        Args: { p_query: string; p_limit?: number };
        Returns: { id: string; score: number; matched_by: string[] }[];
      };
      log_search: { Args: { p_query: string; p_guide_hits: number }; Returns: undefined };
      search_gaps: {
        Args: { p_days?: number; p_min_times?: number; p_limit?: number };
        Returns: { query: string; times: number; last_searched: string }[];
      };
      top_guides: {
        Args: { p_days?: number; p_limit?: number };
        Returns: { guide_id: string; opens: number; last_opened: string }[];
      };
      weekly_activity: {
        Args: { p_weeks?: number };
        Returns: { week_start: string; opens: number; searches: number; unmatched: number; added: number; edited: number }[];
      };
      is_member: { Args: Record<PropertyKey, never>; Returns: boolean };
      is_owner: { Args: Record<PropertyKey, never>; Returns: boolean };
      owner_name: { Args: Record<PropertyKey, never>; Returns: string | null };
      team_settings: { Args: Record<PropertyKey, never>; Returns: { chat_model: string; chat_web_search: boolean }[] };
      team_answers_today: { Args: Record<PropertyKey, never>; Returns: number };
      e2e_cleanup: { Args: Record<PropertyKey, never>; Returns: number };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Update"];
