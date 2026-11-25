import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { cleanPantry, getPantry, PANTRY_MAX } from "@/lib/pantry";
import { supabase } from "@/lib/supabase";

/** Body: { items: string[], on: boolean } adds items to the pantry, or takes them out. */
export async function PUT(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const b = await req.json().catch(() => ({}));
  const items = cleanPantry(b.items);
  if (!items.length || items.length > PANTRY_MAX) return NextResponse.json({ error: "bad request" }, { status: 400 });

  try {
    const have = await getPantry(uid);
    if (!have) return NextResponse.json({ error: "The pantry isn't set up yet. Run pnpm db:deploy." }, { status: 503 });
    if (b.on && new Set([...have, ...items]).size > PANTRY_MAX)
      return NextResponse.json({ error: `Your pantry can hold ${PANTRY_MAX} items` }, { status: 400 });
    const sb = supabase();
    // Removed one by one: a list filter can't hold names with quote marks in them
    const results = b.on
      ? [await sb.from("pantry_items").upsert(items.map((item) => ({ user_id: uid, item })), { ignoreDuplicates: true })]
      : await Promise.all(items.map((item) => sb.from("pantry_items").delete().eq("user_id", uid).eq("item", item)));
    const failed = results.find((r) => r.error);
    if (failed) throw new Error(failed.error!.message);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Couldn't save your pantry" }, { status: 500 });
  }
}
