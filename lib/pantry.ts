import { supabase } from "@/lib/supabase";

export const PANTRY_MAX = 100;

/** Lower-cased, without duplicates or blanks. */
export function cleanPantry(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.map((x) => String(x ?? "").trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60)).filter(Boolean))];
}

/** What the user has at home, or null if the database doesn't have the pantry table yet. */
export async function getPantry(uid: string): Promise<string[] | null> {
  const { data, error } = await supabase().from("pantry_items").select("item").eq("user_id", uid).order("created_at").order("item");
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return null;
    throw new Error(error.message);
  }
  return data.map((r) => r.item);
}
