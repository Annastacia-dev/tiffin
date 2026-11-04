import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { hashPassword, normEmail, passwordProblem, validEmail } from "@/lib/password";

export const dynamic = "force-dynamic";

async function signupOpen() {
  const { count, error } = await supabase().from("users").select("id", { count: "exact", head: true });
  if (error) throw error;
  return (count ?? 0) === 0;
}

/** Sign-up is only open until the first account exists. */
export async function GET() {
  try {
    return NextResponse.json({ open: await signupOpen() });
  } catch (e: any) {
    return NextResponse.json({ open: false, error: e.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}));
  const email = normEmail(b.email);
  const name = String(b.name || "").trim().slice(0, 80);
  const password = String(b.password || "");
  if (!validEmail(email)) return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  const pw = passwordProblem(password);
  if (pw) return NextResponse.json({ error: pw }, { status: 400 });
  if (!(await signupOpen())) return NextResponse.json({ error: "Sign-up is closed." }, { status: 403 });

  const { error } = await supabase().from("users").insert({ email, name, password_hash: hashPassword(password) });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
