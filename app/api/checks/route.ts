import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/** Body: { key: string, on: boolean } — ticks or unticks a shopping list item. */
export async function PUT(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const { key, on } = await req.json().catch(() => ({}));
  if (!key || typeof key !== "string") return NextResponse.json({ error: "bad request" }, { status: 400 });
  const sb = supabase();
  const { error } = on
    ? await sb.from("shopping_checks").upsert({ user_id: uid, key: key.slice(0, 300) })
    : await sb.from("shopping_checks").delete().eq("user_id", uid).eq("key", key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  // Tidy ticks older than 90 days
  await sb.from("shopping_checks").delete().eq("user_id", uid).lt("created_at", new Date(Date.now() - 90 * 864e5).toISOString());
  return NextResponse.json({ ok: true });
}
