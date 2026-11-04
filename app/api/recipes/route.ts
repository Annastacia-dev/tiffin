import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { cleanRecipe, recipeToRow } from "@/lib/types";

/** Body: { recipes: Recipe[] } — creates or replaces recipes. */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const body = await req.json().catch(() => ({}));
  const list = Array.isArray(body.recipes) ? body.recipes : [];
  const rows = list.map((x: any) => cleanRecipe(x)).filter(Boolean).slice(0, 50).map((r: any) => recipeToRow(uid, r));
  if (!rows.length) return NextResponse.json({ error: "no valid recipes" }, { status: 400 });
  const { error } = await supabase().from("recipes").upsert(rows, { onConflict: "user_id,id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, ids: rows.map((r: any) => r.id) });
}
