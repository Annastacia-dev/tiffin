import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { hashPassword, normEmail, passwordProblem, validEmail, verifyPassword } from "@/lib/password";

export const dynamic = "force-dynamic";

export async function GET() {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json({ email: u.email, name: u.name });
}

/**
 * Body: { name, email, currentPassword?, newPassword? }
 * Changing the email or password needs the current password.
 */
export async function PUT(req: Request) {
  const u = await currentUser();
  if (!u) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = await req.json().catch(() => ({}));
  const name = String(b.name ?? u.name).trim().slice(0, 80);
  const email = normEmail(b.email ?? u.email);
  const newPassword = String(b.newPassword || "");
  const sb = supabase();

  const update: Record<string, string> = { name };
  if (email !== u.email || newPassword) {
    const { data: row } = await sb.from("users").select("password_hash").eq("id", u.id).single();
    if (!row || !verifyPassword(String(b.currentPassword || ""), row.password_hash)) {
      await new Promise((r) => setTimeout(r, 1000));
      return NextResponse.json({ error: "Your current password is wrong." }, { status: 400 });
    }
    if (email !== u.email) {
      if (!validEmail(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
      update.email = email;
    }
    if (newPassword) {
      const pw = passwordProblem(newPassword);
      if (pw) return NextResponse.json({ error: pw }, { status: 400 });
      update.password_hash = hashPassword(newPassword);
    }
  }
  const { error } = await sb.from("users").update(update).eq("id", u.id);
  if (error) {
    const taken = error.code === "23505";
    return NextResponse.json({ error: taken ? "That email is already in use." : error.message }, { status: taken ? 400 : 500 });
  }
  return NextResponse.json({ ok: true, email: update.email ?? u.email, name });
}
