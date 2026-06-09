/**
 * Placeholder Supabase Database type.
 *
 * Replace with generated types from the Supabase CLI once the schema stabilises:
 *   npx supabase gen types typescript --project-id <id> > lib/supabase/types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
