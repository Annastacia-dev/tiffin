import { createClient, SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** Server-only Supabase client using the service role key. Never import from client components. */
export function supabase(): SupabaseClient {
  if (!client) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

/**
 * Whether Tiffin's one account exists yet. This reads a row rather than using a
 * head count: a failed head request has no body, so supabase-js reports no error.
 */
export async function accountExists(): Promise<boolean> {
  const { data, error } = await supabase().from("users").select("id").limit(1);
  if (error) throw error;
  return data.length > 0;
}
