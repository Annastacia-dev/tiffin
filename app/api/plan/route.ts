import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/** Body: { changes: { "2026-11-09": { "Lunch": "recipeId" | null } } } — null clears the slot. */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const { changes } = await req.json().catch(() => ({}));
  if (!changes || typeof changes !== "object") return NextResponse.json({ error: "bad request" }, { status: 400 });

  const upserts: { user_id: string; date: string; meal: string; recipe_id: string }[] = [];
  const deletes: { date: string; meal: string }[] = [];
  for (const [date, meals] of Object.entries(changes as Record<string, Record<string, string | null>>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !meals || typeof meals !== "object") continue;
    for (const [meal, id] of Object.entries(meals)) {
      const m = String(meal).slice(0, 20);
      if (id) upserts.push({ user_id: uid, date, meal: m, recipe_id: String(id) });
      else deletes.push({ date, meal: m });
    }
  }
  const sb = supabase();
  if (upserts.length) {
    const { error } = await sb.from("plan_slots").upsert(upserts, { onConflict: "user_id,date,meal" });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  for (const d of deletes) {
    const { error } = await sb.from("plan_slots").delete().eq("user_id", uid).eq("date", d.date).eq("meal", d.meal);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
