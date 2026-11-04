import { NextResponse } from "next/server";
import { pushConfigured, sendToUser } from "@/lib/push";
import { allReminders, dueReminders } from "@/lib/reminders";
import { supabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, rowToRecipe } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const DAY = 864e5;

/** Called every 15 minutes by a scheduler (see README), with `Authorization: Bearer <CRON_SECRET>`. */
async function run(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set" }, { status: 503 });
  if (req.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!pushConfigured()) return NextResponse.json({ error: "Push keys aren't set up" }, { status: 503 });

  const sb = supabase();
  const now = new Date();
  const { data: subs, error } = await sb.from("push_subscriptions").select("user_id");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Prep can start up to 4 days ahead, and the extra days on each side cover every time zone
  const from = new Date(now.getTime() - DAY).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 6 * DAY).toISOString().slice(0, 10);

  let sent = 0;
  for (const uid of new Set((subs || []).map((s) => s.user_id))) {
    const [settings, slots, recipes] = await Promise.all([
      sb.from("settings").select("data").eq("user_id", uid).maybeSingle(),
      sb.from("plan_slots").select("date, meal, recipe_id").eq("user_id", uid).gte("date", from).lte("date", to),
      sb.from("recipes").select("*").eq("user_id", uid),
    ]);
    const failed = settings.error || slots.error || recipes.error;
    if (failed) {
      console.error("Reminders: couldn't load data", uid, failed.message);
      continue;
    }
    const st = { ...DEFAULT_SETTINGS, ...(settings.data?.data || {}) };
    const byId = Object.fromEntries((recipes.data || []).map((r) => [r.id, rowToRecipe(r)]));
    const due = dueReminders(allReminders(slots.data || [], byId, st), now);

    if (due.length) {
      // Claim first, so two overlapping runs can't send the same reminder twice
      const claimed = await sb
        .from("sent_reminders")
        .upsert(
          due.map((r) => ({ user_id: uid, key: r.key })),
          { onConflict: "user_id,key", ignoreDuplicates: true }
        )
        .select("key");
      if (claimed.error) {
        console.error("Reminders: couldn't record", uid, claimed.error.message);
        continue;
      }
      const fresh = new Set((claimed.data || []).map((c) => c.key));
      for (const r of due.filter((d) => fresh.has(d.key))) {
        const result = await sendToUser(uid, { title: r.title, body: r.body, tag: r.key, url: "/#plan" });
        sent += result.sent;
        // Nothing got through: release the claim so the next run tries again
        if (!result.sent) await sb.from("sent_reminders").delete().eq("user_id", uid).eq("key", r.key);
      }
    }
    await sb.from("sent_reminders").delete().eq("user_id", uid).lt("sent_at", new Date(now.getTime() - 14 * DAY).toISOString());
  }
  return NextResponse.json({ ok: true, sent });
}

export const GET = run;
export const POST = run;
