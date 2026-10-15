import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | undefined;

/**
 * This service-role client must only be imported by the API server.
 * It is never exposed to the browser; every database request is authorized
 * against the signed-in Clerk user before this client is used.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (adminClient) return adminClient;

  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("SUPABASE_NOT_CONFIGURED");
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
  return adminClient;
}

export function supabaseUnavailable(
  req: { log: { warn: (obj: object, message: string) => void } },
  res: {
    status: (status: number) => {
      json: (body: { error: string }) => unknown;
    };
  },
  error: unknown,
): void {
  const message = error instanceof Error ? error.message : "";
  if (message === "SUPABASE_NOT_CONFIGURED") {
    res.status(503).json({
      error: "Supabase is not connected. Add the project URL and server service key in Secrets.",
    });
    return;
  }

  const dbError = error as { code?: string; message?: string };
  req.log.warn({ code: dbError.code }, "Supabase request failed");
  if (dbError.code === "42P01" || dbError.code === "PGRST202" || dbError.code === "PGRST205") {
    res.status(503).json({
      error: "The Smart Kisan database schema has not been applied to Supabase yet.",
    });
    return;
  }
  res.status(500).json({ error: "The request could not be completed." });
}
