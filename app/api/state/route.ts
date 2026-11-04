import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { pushConfigured } from "@/lib/push";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, rowToRecipe } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Everything the planner needs, for the signed-in user. */
export async function GET() {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const uid = user.id;
  const sb = supabase();

  const [recipes, slots, settings, checks, account, prices] = await Promise.all([
    sb.from("recipes").select("*").eq("user_id", uid),
    sb.from("plan_slots").select("date, meal, recipe_id").eq("user_id", uid),
    sb.from("settings").select("data").eq("user_id", uid).maybeSingle(),
    sb.from("shopping_checks").select("key").eq("user_id", uid),
    sb.from("users").select("password_hash").eq("id", uid).maybeSingle(),
    sb.from("ingredient_prices").select("item, unit, currency, price").eq("user_id", uid),
  ]);
  const err = recipes.error || slots.error || settings.error || checks.error || account.error || prices.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const days: Record<string, Record<string, string>> = {};
  for (const s of slots.data || []) (days[s.date] ||= {})[s.meal] = s.recipe_id;

  const merged = { ...DEFAULT_SETTINGS, ...(settings.data?.data || {}) };

  return NextResponse.json({
    recipes: Object.fromEntries((recipes.data || []).map((r) => [r.id, rowToRecipe(r)])),
    days,
    settings: merged,
    prices: Object.fromEntries((prices.data || []).filter((p) => p.currency === merged.currency).map((p) => [p.item + "|" + p.unit, p.price])),
    checks: Object.fromEntries((checks.data || []).map((c) => [c.key, true])),
    push: { publicKey: pushConfigured() ? process.env.VAPID_PUBLIC_KEY : null },
    profile: { name: user.name, email: user.email, hasPassword: !!account.data?.password_hash },
  });
}
