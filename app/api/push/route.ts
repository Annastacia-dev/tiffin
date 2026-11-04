import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { validTimeZone } from "@/lib/types";

/** Body: { subscription: PushSubscriptionJSON, timezone } — turns reminders on for this device. */
export async function POST(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const { subscription: s, timezone } = await req.json().catch(() => ({}));
  if (!s?.endpoint?.startsWith?.("https://") || !s.keys?.p256dh || !s.keys?.auth) return NextResponse.json({ error: "bad subscription" }, { status: 400 });
  const sb = supabase();
  const { error } = await sb
    .from("push_subscriptions")
    .upsert({ endpoint: String(s.endpoint).slice(0, 1000), user_id: uid, p256dh: String(s.keys.p256dh).slice(0, 200), auth: String(s.keys.auth).slice(0, 100) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reminders run on the server, so it needs to know this person's time zone
  if (validTimeZone(timezone)) {
    const { data } = await sb.from("settings").select("data").eq("user_id", uid).maybeSingle();
    const saved = await sb.from("settings").upsert({ user_id: uid, data: { ...(data?.data || {}), timezone }, updated_at: new Date().toISOString() });
    if (saved.error) return NextResponse.json({ error: saved.error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** Body: { endpoint } — turns reminders off for this device. */
export async function DELETE(req: Request) {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  const { endpoint } = await req.json().catch(() => ({}));
  if (!endpoint) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const { error } = await supabase().from("push_subscriptions").delete().eq("user_id", uid).eq("endpoint", String(endpoint));
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
