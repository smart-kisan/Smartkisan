import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createClient } from "@supabase/supabase-js";

type PublicBuildEnv = {
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
};
const viteEnv = (import.meta as ImportMeta & { env?: PublicBuildEnv }).env;
const nextSupabaseUrl =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_URL : undefined;
const nextSupabaseAnonKey =
  typeof process !== 'undefined' ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined;
const supabaseUrl =
  viteEnv?.NEXT_PUBLIC_SUPABASE_URL ?? viteEnv?.VITE_SUPABASE_URL ?? nextSupabaseUrl;
const supabaseAnonKey =
  viteEnv?.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
  viteEnv?.VITE_SUPABASE_ANON_KEY ??
  nextSupabaseAnonKey;
const realtimeClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
    })
  : null;

/**
 * Public realtime channel carries invalidation signals only. Business data is
 * always reloaded from the authenticated API; private rows are never cached.
 */
export function MarketplaceRealtime() {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!realtimeClient) return;
    const channel = realtimeClient
      .channel("smart-kisan-marketplace-signals")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "marketplace_events",
      }, () => {
        void queryClient.invalidateQueries();
      })
      .subscribe();

    return () => {
      void realtimeClient.removeChannel(channel);
    };
  }, [queryClient]);

  return null;
}
