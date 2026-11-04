import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/** Deletes a recipe; plan slots using it are removed by the foreign key cascade. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const { id } = await params;
  const { error } = await supabase().from("recipes").delete().eq("user_id", uid).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
