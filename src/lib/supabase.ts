import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// O Lovable Cloud preenche estas variáveis automaticamente quando é ativado.
const url = import.meta.env["VITE_SUPABASE_URL"] as string | undefined;
const key = (import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ??
  import.meta.env["VITE_SUPABASE_ANON_KEY"]) as string | undefined;

let client: SupabaseClient | null = null;

/** Cliente do banco compartilhado, ou null se o Lovable Cloud ainda não estiver ativado. */
export function getSupabase(): SupabaseClient | null {
  if (typeof window === "undefined" || !url || !key) return null;
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, storage: window.localStorage },
    });
  }
  return client;
}

export const BUCKET = "anexos";
