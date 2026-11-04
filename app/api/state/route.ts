import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, rowToRecipe } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Everything the planner needs, for the signed-in user. */
export async function GET() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const sb = supabase();

  const [recipes, slots, settings, checks] = await Promise.all([
    sb.from("recipes").select("*").eq("user_id", uid),
    sb.from("plan_slots").select("date, meal, recipe_id").eq("user_id", uid),
    sb.from("settings").select("data").eq("user_id", uid).maybeSingle(),
    sb.from("shopping_checks").select("key").eq("user_id", uid),
  ]);
  const err = recipes.error || slots.error || settings.error || checks.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const days: Record<string, Record<string, string>> = {};
  for (const s of slots.data || []) (days[s.date] ||= {})[s.meal] = s.recipe_id;

  return NextResponse.json({
    recipes: Object.fromEntries((recipes.data || []).map((r) => [r.id, rowToRecipe(r)])),
    days,
    settings: { ...DEFAULT_SETTINGS, ...(settings.data?.data || {}) },
    checks: Object.fromEntries((checks.data || []).map((c) => [c.key, true])),
  });
}
