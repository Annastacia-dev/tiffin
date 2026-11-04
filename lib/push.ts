import webpush from "web-push";
import { supabase } from "@/lib/supabase";

export type PushMessage = { title: string; body: string; tag?: string; url?: string };

export function pushConfigured() {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}

/** Sends to every device the user turned reminders on for, and forgets devices the push service says are gone. */
export async function sendToUser(userId: string, message: PushMessage) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  const sb = supabase();
  const { data: subs, error } = await sb.from("push_subscriptions").select("endpoint, p256dh, auth").eq("user_id", userId);
  if (error) throw error;
  let sent = 0;
  for (const s of subs || []) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(message), { TTL: 3600 });
      sent++;
    } catch (e: any) {
      if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
      else console.error("Push failed", e?.statusCode, e?.message);
    }
  }
  return { sent, devices: subs?.length ?? 0 };
}
