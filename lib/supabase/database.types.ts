// Generated from the Supabase schema (supabase/migrations). Regenerate after every migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.18";
  };
  public: {
    Tables: {
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
          user_id: string;
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
          user_id: string;
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
          user_id: string;
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
      guide_revisions: {
        Row: {
          created_at: string;
          guide_id: string;
          id: string;
          snapshot: Json | null;
          summary: string;
          user_id: string;
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
          prevention: string | null;
          product: string;
          steps: string[];
          symptom: string;
          tags: string[];
          title: string;
          updated_at: string;
          user_id: string;
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
          prevention?: string | null;
          product: string;
          steps?: string[];
          symptom?: string;
          tags?: string[];
          title: string;
          updated_at?: string;
          user_id?: string;
          uses?: number;
          verified?: boolean;
          version?: string;
        };
        Update: Partial<Database["public"]["Tables"]["guides"]["Insert"]>;
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
          user_id: string;
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
      release_note_guides: {
        Row: {
          guide_id: string;
          release_note_id: string;
          user_id: string;
        };
        Insert: {
          guide_id: string;
          release_note_id: string;
          user_id?: string;
        };
        Update: Partial<Database["public"]["Tables"]["release_note_guides"]["Insert"]>;
        Relationships: [
          { foreignKeyName: "release_note_guides_guide_id_fkey"; columns: ["guide_id"]; isOneToOne: false; referencedRelation: "guides"; referencedColumns: ["id"] },
          { foreignKeyName: "release_note_guides_release_note_id_fkey"; columns: ["release_note_id"]; isOneToOne: false; referencedRelation: "release_notes"; referencedColumns: ["id"] },
        ];
      };
      release_notes: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          detail: string;
          id: string;
          product: string;
          title: string;
          type: string;
          updated_at: string;
          user_id: string;
          version: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          detail?: string;
          id?: string;
          product: string;
          title: string;
          type: string;
          updated_at?: string;
          user_id?: string;
          version: string;
        };
        Update: Partial<Database["public"]["Tables"]["release_notes"]["Insert"]>;
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
          user_id: string;
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
          user_id?: string;
          uses?: number;
        };
        Update: Partial<Database["public"]["Tables"]["templates"]["Insert"]>;
        Relationships: [];
      };
      user_settings: {
        Row: {
          analyst_model: string;
          default_model: string;
          mask_sensitive: boolean;
          official_sites: string[];
          searxng_url: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          analyst_model?: string;
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
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> = Database["public"]["Tables"][T]["Insert"];
