import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { pushConfigured, sendToUser } from "@/lib/push";

/** Sends a test notification to the signed-in user's devices. */
export async function POST() {
  const uid = await requireUser();
  if (uid instanceof NextResponse) return uid;
  if (!pushConfigured()) return NextResponse.json({ error: "Push keys aren't set up on the server." }, { status: 503 });
  const result = await sendToUser(uid, { title: "Tiffin reminders are on", body: "Prep reminders will look like this.", tag: "tiffin-test" });
  return NextResponse.json(result);
}
