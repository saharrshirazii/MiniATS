// Supabase database types for the MiniATS schema.
//
// Regenerate after every migration so this file matches the real database:
//   npm run db:types
//
// Written by hand to match supabase/migrations/* until the first regeneration.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      applications: {
        Row: {
          ai_assessed_at: string | null;
          ai_score: number | null;
          ai_summary: string | null;
          candidate_id: string;
          created_at: string;
          id: string;
          job_id: string;
          position: number;
          stage: Database["public"]["Enums"]["application_stage"];
          updated_at: string;
        };
        Insert: {
          ai_assessed_at?: string | null;
          ai_score?: number | null;
          ai_summary?: string | null;
          candidate_id: string;
          created_at?: string;
          id?: string;
          job_id: string;
          position?: number;
          stage?: Database["public"]["Enums"]["application_stage"];
          updated_at?: string;
        };
        Update: {
          ai_assessed_at?: string | null;
          ai_score?: number | null;
          ai_summary?: string | null;
          candidate_id?: string;
          created_at?: string;
          id?: string;
          job_id?: string;
          position?: number;
          stage?: Database["public"]["Enums"]["application_stage"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_candidate_id_fkey";
            columns: ["candidate_id"];
            isOneToOne: false;
            referencedRelation: "candidates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      candidates: {
        Row: {
          created_at: string;
          created_by: string | null;
          cv_path: string | null;
          email: string | null;
          full_name: string;
          id: string;
          linkedin_url: string | null;
          notes: string | null;
          organization_id: string;
          phone: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          cv_path?: string | null;
          email?: string | null;
          full_name: string;
          id?: string;
          linkedin_url?: string | null;
          notes?: string | null;
          organization_id: string;
          phone?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          cv_path?: string | null;
          email?: string | null;
          full_name?: string;
          id?: string;
          linkedin_url?: string | null;
          notes?: string | null;
          organization_id?: string;
          phone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "candidates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          location: string | null;
          organization_id: string;
          status: Database["public"]["Enums"]["job_status"];
          title: string;
          updated_at: string;
          workplace_type: Database["public"]["Enums"]["workplace_type"] | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          location?: string | null;
          organization_id: string;
          status?: Database["public"]["Enums"]["job_status"];
          title: string;
          updated_at?: string;
          workplace_type?: Database["public"]["Enums"]["workplace_type"] | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          location?: string | null;
          organization_id?: string;
          status?: Database["public"]["Enums"]["job_status"];
          title?: string;
          updated_at?: string;
          workplace_type?: Database["public"]["Enums"]["workplace_type"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string;
          id: string;
          name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          organization_id: string | null;
          role: Database["public"]["Enums"]["user_role"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          organization_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          organization_id?: string | null;
          role?: Database["public"]["Enums"]["user_role"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      my_org: { Args: Record<PropertyKey, never>; Returns: string };
    };
    Enums: {
      application_stage: "applied" | "screening" | "interview" | "offer" | "hired" | "rejected";
      job_status: "open" | "closed";
      user_role: "admin" | "customer";
      workplace_type: "on_site" | "hybrid" | "remote";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

// ---- Convenience aliases used across the app ----
type PublicSchema = Database["public"];

export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Enums<T extends keyof PublicSchema["Enums"]> = PublicSchema["Enums"][T];
